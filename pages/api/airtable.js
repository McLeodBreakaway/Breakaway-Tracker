const TOKEN = 'patZKMyhLRT3eVQol.6cdf1e78486331a4fe6b5ec2a86ed4cc072d0138c854e4ba0ad5aeaf5f06c70f'
const BASE_ID = 'appXO1e7MlqaiV7gF'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { table, action, payload, recordIds, offset } = req.body

  try {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`
    const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

    let response
    if (action === 'list') {
      url += offset ? `?offset=${offset}` : ''
      response = await fetch(url, { method: 'GET', headers })
    } else if (action === 'create') {
      response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
    } else if (action === 'delete') {
      const params = recordIds.map(id => `records[]=${id}`).join('&')
      response = await fetch(`${url}?${params}`, { method: 'DELETE', headers })
    } else {
      return res.status(400).json({ error: 'Invalid action' })
    }

    const data = await response.json()
    if (!response.ok) return res.status(response.status).json(data)
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
