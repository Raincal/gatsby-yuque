const dayjs = require('dayjs')
const Entities = require('html-entities').AllHtmlEntities
const grayMatter = require('gray-matter')
const report = require('gatsby-cli/lib/reporter')

const entities = new Entities()

/**
 * front matter 反序列化
 *
 * @param {String} body md 文档
 * @return {Object} data
 */
exports.parseMatter = body => {
	body = entities.decode(body)
	try {
		// front matter 信息的 <br/> 换成 \n
		const regex = /(---|title:|layout:|tags:|date:|categories:){1}(\S|\s)+?---/gi
		body = body.replace(regex, a => a.replace(/(<br \/>|<br>|<br\/>)/gi, '\n'))
		const result = grayMatter(body)
		const data = {
			...result.data,
			body: result.content
		}
		return data
	} catch (error) {
		report.error(error)
		return {
			body
		}
	}
}

/**
 * 转换为本地时间
 *
 * @param {Date} date UTC
 * @return {Date} local Time
 */
exports.formatDate = date => {
	return dayjs(date).format('YYYY-MM-DDTHH:mm:ss')
}

/**
 * 格式化 markdown 内容
 *
 * @param {Array} items items
 * @return {String} body
 */
exports.formatArray = items => {
	items = Array.isArray(items) ? items : isString(items) ? [items] : []
	return `[${items.join(',')}]`
}

/**
 * 判断是否为字符串
 * @param {any} x
 */
function isString(x) {
	return Object.prototype.toString.call(x) === '[object String]'
}
