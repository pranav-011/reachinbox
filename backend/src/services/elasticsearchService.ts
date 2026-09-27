import { Client } from '@elastic/elasticsearch';
import { config } from '../config/index.js';

let esClient: Client | null = null;
let isEsAvailable = false;

export function getElasticsearchClient(): Client {
  if (!esClient) {
    esClient = new Client({
      node: config.elasticsearch.node,
      maxRetries: 3,
      requestTimeout: 4000,
    });
  }
  return esClient;
}

export async function initElasticsearch(): Promise<boolean> {
  const client = getElasticsearchClient();
  const index = config.elasticsearch.index;

  try {
    const ping = await client.ping();
    if (!ping) {
      console.warn(`⚠️ Elasticsearch node at ${config.elasticsearch.node} did not respond to ping.`);
      isEsAvailable = false;
      return false;
    }

    const indexExists = await client.indices.exists({ index });
    if (!indexExists) {
      await client.indices.create({
        index,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            senderEmail: { type: 'keyword' },
            status: { type: 'keyword' },
            scheduledTime: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
            etherealPreviewUrl: { type: 'keyword' },
          },
        },
      });
      console.log(`✅ Elasticsearch index '${index}' created successfully.`);
    } else {
      console.log(`✅ Elasticsearch index '${index}' verified.`);
    }

    isEsAvailable = true;
    return true;
  } catch (err: any) {
    console.warn(`⚠️ Elasticsearch is not available (${err.message}). Search will gracefully fallback to DB queries.`);
    isEsAvailable = false;
    return false;
  }
}

export interface EmailDocument {
  id: string;
  userId?: string | null;
  recipient: string;
  subject: string;
  body: string;
  senderEmail: string;
  status: string;
  scheduledTime: Date | string;
  sentAt?: Date | string | null;
  createdAt: Date | string;
  etherealPreviewUrl?: string | null;
}

export async function indexEmail(doc: EmailDocument): Promise<void> {
  if (!isEsAvailable) return;

  const client = getElasticsearchClient();
  try {
    await client.index({
      index: config.elasticsearch.index,
      id: doc.id,
      document: {
        ...doc,
        scheduledTime: new Date(doc.scheduledTime).toISOString(),
        sentAt: doc.sentAt ? new Date(doc.sentAt).toISOString() : null,
        createdAt: new Date(doc.createdAt).toISOString(),
      },
    });
  } catch (error: any) {
    console.warn(`⚠️ Failed to index email ${doc.id} in Elasticsearch:`, error.message);
  }
}

export async function searchEmailsInES(params: {
  query: string;
  status?: string;
  userId?: string;
  from?: number;
  size?: number;
}): Promise<{ total: number; ids: string[]; hits: any[] }> {
  if (!isEsAvailable) {
    return { total: 0, ids: [], hits: [] };
  }

  const client = getElasticsearchClient();
  const { query, status, userId, from = 0, size = 50 } = params;

  const mustClauses: any[] = [];

  if (query && query.trim().length > 0) {
    mustClauses.push({
      multi_match: {
        query: query.trim(),
        fields: ['recipient^3', 'subject^2', 'body', 'senderEmail'],
        fuzziness: 'AUTO',
      },
    });
  } else {
    mustClauses.push({ match_all: {} });
  }

  const filterClauses: any[] = [];
  if (status) {
    filterClauses.push({ term: { status } });
  }
  if (userId) {
    filterClauses.push({ term: { userId } });
  }

  try {
    const result = await client.search({
      index: config.elasticsearch.index,
      from,
      size,
      query: {
        bool: {
          must: mustClauses,
          filter: filterClauses,
        },
      },
      sort: [{ createdAt: { order: 'desc' } }],
    });

    const hits = result.hits.hits.map((h: any) => ({
      _id: h._id,
      ...h._source,
    }));
    const total = typeof result.hits.total === 'number' ? result.hits.total : (result.hits.total?.value || hits.length);
    const ids = hits.map((h: any) => h.id || h._id);

    return { total, ids, hits };
  } catch (error: any) {
    console.warn('⚠️ Elasticsearch search error:', error.message);
    return { total: 0, ids: [], hits: [] };
  }
}

export function isElasticsearchReady(): boolean {
  return isEsAvailable;
}
