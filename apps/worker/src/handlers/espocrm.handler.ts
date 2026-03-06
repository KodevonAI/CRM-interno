import type { Job } from 'bullmq'
import type { EspocrmSyncPayload } from '@kodevon/shared'
import { prisma } from '../lib/prisma'
import { espocrm, toEspoCRMLead } from '../lib/espocrm'

export async function handleEspocrmSync(job: Job<EspocrmSyncPayload>): Promise<void> {
  const { leadId, action } = job.data

  if (!espocrm.isConfigured()) {
    // No hay API key — skip silencioso (EspoCRM opcional)
    return
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } })

  if (!lead) {
    console.warn(`[espocrm] Lead no encontrado: ${leadId}`)
    return
  }

  const espoCRMData = toEspoCRMLead({
    name:          lead.name,
    email:         lead.email,
    phone:         lead.phone,
    company:       lead.company,
    sourceChannel: lead.sourceChannel as any,
    stage:         lead.stage as any,
    notes:         lead.notes,
  })

  if (action === 'create') {
    const { id: espocrmId } = await espocrm.createLead(espoCRMData)

    await prisma.lead.update({
      where: { id: leadId },
      data:  { espocrmId },
    })

    console.log(`[espocrm] Lead creado → EspoCRM ID: ${espocrmId}`)
    return
  }

  if (action === 'update') {
    if (!lead.espocrmId) {
      // Nunca se sincronizó — crear en vez de actualizar
      const { id: espocrmId } = await espocrm.createLead(espoCRMData)
      await prisma.lead.update({ where: { id: leadId }, data: { espocrmId } })
      console.log(`[espocrm] Lead creado (fallback de update) → EspoCRM ID: ${espocrmId}`)
      return
    }

    await espocrm.updateLead(lead.espocrmId, espoCRMData)
    console.log(`[espocrm] Lead actualizado → EspoCRM ID: ${lead.espocrmId}`)
  }
}
