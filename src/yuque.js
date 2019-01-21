const axios = require('axios')
const report = require('gatsby-cli/lib/reporter')

const instance = axios.create({
	baseURL: 'https://www.yuque.com/api/v2/',
	timeout: 10000,
})

class YuqueClient {
	constructor(config) {
		this.config = config
		this.yuquePath = config.yuquePath
		this._cachedArticles = []
		this._needUpdate = false
	}

	async _fetch(api) {
		const { namespace } = this.config
		const path = `repos/${namespace}${api}`
		report.info(`request data: api: ${path}`)
		try {
			const result = await instance(path)
			return result.data
		} catch (error) {
			throw new Error(`请求数据失败: ${error.message}`)
		}
	}

	async getArticles() {
		const api = '/docs'
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
