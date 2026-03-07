const TOKEN = 'patZKMyhLRT3eVQol.6cdf1e78486331a4fe6b5ec2a86ed4cc072d0138c854e4ba0ad5aeaf5f06c70f'
const BASE_ID = 'appXO1e7MlqaiV7gF'

export default async function handler(req, res) {
  const { table, method: reqMethod, body, recordIds } = req.body || {}
  const httpMethod = req.method

  try {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`
    let options = {
      method: httpMethod === 'DELETE' ? 'DELETE' : reqMethod || 'GET',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    }

    if (httpMethod === 'DELETE' && recordIds) {
      const params = recordIds.map(id => `records[]=${id}`).join('&')
      url += `?${params}`
    }

    if (options.method === 'POST' && body) {
      options.body = JSON.stringify(body)
    }

    if (options.method === 'GET') {
      const { offset } = req.body || {}
      if (offset) url += `?offset=${offset}`
    }

    const response = await fetch(url, options)
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
