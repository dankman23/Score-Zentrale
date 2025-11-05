/**
 * JTL-Glossar Publishing
 * Speichert Glossar als JSON-Datei und bietet In-Memory-Cache
 */

import fs from 'fs/promises'
import path from 'path'
import { GlossarySchema } from './normalize'

const GLOSSARY_DIR = path.join(process.cwd(), 'data', 'glossary')

// In-Memory Cache
const glossaryCache = new Map<string, GlossarySchema>()

/**
 * Speichert Glossar als JSON-Datei
 */
export async function publishGlossary(schema: GlossarySchema): Promise<string> {
  const filename = `glossary-${schema.version}.json`
  const filepath = path.join(GLOSSARY_DIR, filename)

  try {
    // Verzeichnis erstellen falls nicht vorhanden
    await fs.mkdir(GLOSSARY_DIR, { recursive: true })

    // JSON schreiben
    await fs.writeFile(
      filepath,
      JSON.stringify(schema, null, 2),
      'utf-8'
    )

    // Cache aktualisieren
    glossaryCache.set(schema.version, schema)

    console.log(`[Publish] Glossar published: ${filepath}`)
    return filepath
  } catch (error) {
    console.error('[Publish] Failed to publish glossar:', error)
    throw new Error(`Failed to publish glossar: ${error}`)
  }
}

/**
 * Lädt Glossar aus Datei oder Cache
 */
export async function loadGlossary(version: string): Promise<GlossarySchema | null> {
  // Cache-Check
  if (glossaryCache.has(version)) {
    console.log(`[Publish] Loaded from cache: ${version}`)
    return glossaryCache.get(version)!
  }

  // Datei laden
  const filename = `glossary-${version}.json`
  const filepath = path.join(GLOSSARY_DIR, filename)

  try {
    const content = await fs.readFile(filepath, 'utf-8')
    const schema = JSON.parse(content) as GlossarySchema

    // Cache aktualisieren
    glossaryCache.set(version, schema)

    console.log(`[Publish] Loaded from file: ${filepath}`)
    return schema
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`[Publish] Glossar not found: ${version}`)
      return null
    }
    console.error('[Publish] Failed to load glossar:', error)
    throw error
  }
}

/**
 * Liste alle verfügbaren Glossar-Versionen
 */
export async function listGlossaryVersions(): Promise<string[]> {
  try {
    await fs.mkdir(GLOSSARY_DIR, { recursive: true })
    const files = await fs.readdir(GLOSSARY_DIR)
    
    const versions = files
      .filter(f => f.startsWith('glossary-') && f.endsWith('.json'))
      .map(f => f.replace('glossary-', '').replace('.json', ''))
      .sort()

    return versions
  } catch (error) {
    console.error('[Publish] Failed to list versions:', error)
    return []
  }
}

/**
 * Cache leeren
 */
export function clearCache(version?: string): void {
  if (version) {
    glossaryCache.delete(version)
    console.log(`[Publish] Cache cleared for version: ${version}`)
  } else {
    glossaryCache.clear()
    console.log('[Publish] Cache cleared (all versions)')
  }
}

/**
 * Statistiken über Cache
 */
export function getCacheStats() {
  return {
    cached_versions: Array.from(glossaryCache.keys()),
    cache_size: glossaryCache.size,
    memory_mb: process.memoryUsage().heapUsed / 1024 / 1024
  }
}
