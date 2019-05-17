const fs = require('fs')
const _ = require('lodash')
const Queue = require('queue')

const { parseMatter } = require('./utils')
const YuqueClient = require('./yuque')

// 需要提取的文章属性字段
const PICK_PROPERTY = [
	'id',
	'title',
	'description',
	'custom_description',
	'created_at',
	'updated_at',
	'published_at',
	'slug',
	'word_count',
	'cover'
]

/**
 * Constructor 下载器
 *
 * @prop {Object} client 语雀 client
 * @prop {Object} context Gatsby Context
 * @prop {Object} yuqueConfig 知识库配置
 * @prop {String} yuquePath 下载的文章缓存的 JSON 文件
 * @prop {Array} _cachedArticles 文章列表
 *
 */
class Downloader {
	constructor(context, yuqueConfig) {
		this.client = new YuqueClient(yuqueConfig)
		this.reporter = context.reporter
		this.yuqueConfig = yuqueConfig
		this.yuquePath = yuqueConfig.yuquePath
		this._cachedArticles = []
		this._needUpdate = false
	}

	/**
	 * 下载文章详情
	 *
	 * @param {Object} item 文章概要
	 * @param {Number} index 所在缓存数组的下标
	 *
	 * @return {Promise} data
	 */
	fetchArticle(item, index) {
		const { client, _cachedArticles, reporter } = this
		return function() {
			reporter.info(`download article body: ${item.title}`)
			return client.getArticle(item.slug).then(({ data: article }) => {
				const cachedArticle = _cachedArticles[index]
				// matter 解析
				const parseRet = parseMatter(article.body, reporter)
				const source = {...item, ...parseRet}
				const newArticle = _.merge(cachedArticle, source)
				_cachedArticles[index] = newArticle
			})
		}
	}

	/**
	 * 下载所有文章
	 * 并根据文章是否有更新来决定是否需要重新下载文章详情
	 *
	 * @return {Promise} queue
	 */
	async fetchArticles() {
		const { _cachedArticles, reporter } = this
		const articles = await this.client.getArticles()
		const realArticles = articles.data
			.filter(article => article.title !== '无标题')
			.map(article => _.pick(article, PICK_PROPERTY))
		const queue = new Queue({ concurrency: 5 })

		let article
		let cacheIndex
		let cacheArticle
		let cacheAvaliable

		const findIndexFn = function(item) {
			return item.id === article.id
		}

		for (let i = 0; i < realArticles.length; i++) {
			article = realArticles[i]
			cacheIndex = _cachedArticles.findIndex(findIndexFn)
			if (cacheIndex < 0) {
				// 未命中缓存，新增一条
				reporter.info(`add new article: ${article.title}`)
				cacheIndex = _cachedArticles.length
				_cachedArticles.push(article)
				this._needUpdate = true
				queue.push(this.fetchArticle(article, cacheIndex))
			} else {
				cacheArticle = _cachedArticles[cacheIndex]
				cacheAvaliable =
					+new Date(article.updated_at) === +new Date(cacheArticle.updated_at)
				if (!cacheAvaliable) {
					cacheArticle.updated_at = article.updated_at
					this._needUpdate = true
					// 文章有变更，更新缓存
					reporter.info(`update article: ${article.title}`)
					queue.push(this.fetchArticle(article, cacheIndex))
				}
			}
		}

		return new Promise((resolve, reject) => {
			queue.start(function(err) {
				if (err) return reject(err)
				reporter.info('download articls done!')
				resolve()
			})
		})
	}

	/**
	 * 读取语雀的文章缓存 json 文件
	 */
	readYuqueCache() {
		const { yuquePath } = this
		try {
			const articles = require(yuquePath)
			if (Array.isArray(articles)) {
				this._cachedArticles = articles
				return
			}
		} catch (error) {
			// Do noting
		}
		this._cachedArticles = []
	}

	/**
	 * 写入语雀的文章缓存 json 文件
	 */
	writeYuqueCache() {
		const { yuquePath, _cachedArticles, reporter } = this
		if (this._needUpdate) {
			reporter.info(`writing to local file: ${yuquePath}`)
			fs.writeFileSync(yuquePath, JSON.stringify(_cachedArticles, null, 2), {
				encoding: 'UTF8'
			})
		}
	}

	// 文章下载 => 增量更新文章到缓存 json 文件
	async autoUpdate() {
		this.readYuqueCache()
		await this.fetchArticles()
		this.writeYuqueCache()
	}
}

module.exports = async function getAllArticles(context, yuqueConfig) {
	const downloader = new Downloader(context, yuqueConfig)
	await downloader.autoUpdate()
	return downloader._cachedArticles
}
