const axios = require(`axios`)
const debug = require(`./debug`)

class YuqueClient {
	constructor(config) {
		this.config = config
	}

	async _fetch(api) {
		const { baseUrl, namespace, timeout } = this.config
		const path = `${baseUrl}repos/${namespace}${api}`
		debug(`request data: api: ${path}`)
		try {
			const result = await axios(path, { timeout })
			return result.data
		} catch (error) {
			throw new Error(`请求数据失败: ${error.message}`)
		}
	}

	async getArticles() {
		const api = `/docs`
		const result = await this._fetch(api)
		return result
	}

	async getArticle(slug) {
		const api = `/docs/${slug}?raw=1`
		const result = await this._fetch(api)
		return result
	}
}

module.exports = YuqueClient
