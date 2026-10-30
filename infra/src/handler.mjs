import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;
// DynamoDB admite 400 KB por registro; se deja margen
const MAX_BYTES = 300 * 1024;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  // El authorizer JWT ya validó el token; "sub" identifica al usuario y es la única llave de acceso
  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return json(401, { error: 'unauthorized' });

  if (event.requestContext.http.method === 'GET') {
    const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { pk: sub } }));
    return json(200, Item ? { state: Item.state, updatedAt: Item.updatedAt } : { state: null });
  }

  const raw = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString() : event.body ?? '';
  if (Buffer.byteLength(raw) > MAX_BYTES) return json(413, { error: 'state too large' });

  let state;
  try {
    state = JSON.parse(raw).state;
  } catch {
    return json(400, { error: 'invalid json' });
  }
  if (state === null || typeof state !== 'object') return json(400, { error: 'state must be an object' });

  const updatedAt = new Date().toISOString();
  await db.send(new PutCommand({ TableName: TABLE, Item: { pk: sub, state, updatedAt } }));
  return json(200, { ok: true, updatedAt });
};
