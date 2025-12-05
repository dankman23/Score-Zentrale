import { ObjectId } from 'mongodb'

/**
 * Prospect ID Helper Functions
 * Vereinheitlichte Logik für ID-Handling (ObjectId vs String ID)
 */

/**
 * Erstellt eine MongoDB-Query die sowohl _id (ObjectId) als auch id (String) berücksichtigt
 * 
 * @param prospectId - Die Prospect-ID (kann String oder ObjectId sein)
 * @returns MongoDB Query Object
 * 
 * @example
 * const query = buildProspectQuery('6932ab47a71322cd53da8b76')
 * const prospect = await db.collection('prospects').findOne(query)
 */
export function buildProspectQuery(prospectId: string | ObjectId) {
  if (!prospectId) {
    throw new Error('Prospect ID ist erforderlich')
  }
  
  // Wenn bereits ein ObjectId, direkt verwenden
  if (prospectId instanceof ObjectId) {
    return { _id: prospectId }
  }
  
  // String-ID: Versuche beide Formate
  try {
    // Versuche als ObjectId zu parsen
    const objectId = new ObjectId(prospectId)
    return {
      $or: [
        { _id: objectId },
        { id: prospectId }
      ]
    }
  } catch (e) {
    // Keine gültige ObjectId, nur nach String-ID suchen
    return { id: prospectId }
  }
}

/**
 * Extrahiert die ID aus einem Prospect-Dokument
 * Priorisiert _id über id für Konsistenz
 * 
 * @param prospect - Das Prospect-Dokument
 * @returns String-Repräsentation der ID
 */
export function getProspectId(prospect: any): string {
  if (!prospect) {
    throw new Error('Prospect-Dokument ist null oder undefined')
  }
  
  // Priorisiere _id
  if (prospect._id) {
    return prospect._id.toString()
  }
  
  // Fallback auf id
  if (prospect.id) {
    return prospect.id
  }
  
  throw new Error('Prospect hat weder _id noch id')
}

/**
 * Konvertiert eine Prospect-ID zu ObjectId (falls möglich)
 * 
 * @param prospectId - Die Prospect-ID (String)
 * @returns ObjectId oder null falls nicht konvertierbar
 */
export function toObjectId(prospectId: string): ObjectId | null {
  try {
    return new ObjectId(prospectId)
  } catch (e) {
    return null
  }
}

/**
 * Prüft ob eine ID eine gültige ObjectId ist
 */
export function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id)
}
