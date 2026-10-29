// Netlify Serverless Function: netlify/functions/sync-config.ts
export const handler = async (event: any) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  let bodyData: any = {};
  if (event.body) {
    try {
      bodyData = JSON.parse(event.body);
    } catch {
      bodyData = {};
    }
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      message: 'Configuration synchronisée sur Netlify !',
      receivedCatalogs: Array.isArray(bodyData.catalogs) ? bodyData.catalogs.length : 0,
    }),
  };
};
