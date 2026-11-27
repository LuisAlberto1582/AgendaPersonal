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

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid json' });
  }
  const state = body?.state;
  if (state === null || typeof state !== 'object') return json(400, { error: 'state must be an object' });

  // Control de concurrencia opcional: si el cliente manda baseUpdatedAt (la versión sobre la que editó),
  // solo se guarda si la nube sigue en esa versión; null significa "aún no hay nada guardado".
  const put = { TableName: TABLE, Item: { pk: sub, state, updatedAt: new Date().toISOString() } };
  if ('baseUpdatedAt' in body) {
    const base = body.baseUpdatedAt;
    if (base === null) {
      put.ConditionExpression = 'attribute_not_exists(pk)';
    } else if (typeof base === 'string') {
      put.ConditionExpression = 'updatedAt = :base';
      put.ExpressionAttributeValues = { ':base': base };
    } else {
      return json(400, { error: 'baseUpdatedAt must be a string or null' });
    }
  }

  try {
    await db.send(new PutCommand(put));
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') throw err;
    // Otro dispositivo guardó antes: se devuelve la versión actual para que el cliente decida
    const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { pk: sub } }));
    return json(409, { error: 'conflict', state: Item?.state ?? null, updatedAt: Item?.updatedAt ?? null });
  }
  return json(200, { ok: true, updatedAt: put.Item.updatedAt });
};
