const TOKEN = 'patZKMyhLRT3eVQol.6cdf1e78486331a4fe6b5ec2a86ed4cc072d0138c854e4ba0ad5aeaf5f06c70f'
const BASE_ID = 'appXO1e7MlqaiV7gF'

export default async function handler(req, res) {
  const { table, method: reqMethod, body, recordIds, offset } = req.body || {}

  try {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`
    let fetchOptions = {
      method: reqMethod || 'GET',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    }

    if (reqMethod === 'DELETE' && recordIds) {
      const params = recordIds.map(id => `records[]=${id}`).join('&')
      url += `?${params}`
    }

    if (reqMethod === 'GET' && offset) {
      url += `?offset=${offset}`
    }

    if (reqMethod === 'POST' && body) {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetch(url, fetchOptions)
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
