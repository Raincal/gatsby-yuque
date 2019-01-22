const crypto = require('crypto')
const path = require('path')
const process = require('process')
const cwd = process.cwd()

const getAllArticles = require('./download')
const { formatDate, formatArray } = require('./utils')

const createContentDigest = obj =>
	crypto
		.createHash('md5')
		.update(JSON.stringify(obj))
		.digest('hex')

exports.sourceNodes = async ({ actions, createNodeId }, pluginOptions) => {
	const { createNode } = actions
	const defaults = {
		baseUrl: 'https://www.yuque.com/api/v2/',
		login: '',
		repo: '',
		mdNameFormat: 'title',
		timeout: 10000
	}

	const options = { ...defaults, ...pluginOptions }

	delete pluginOptions.plugins

	const { login, repo, mdNameFormat } = options

	if (!login || !repo) {
		return
	}

	const config = {
		baseUrl: options.baseUrl,
		namespace: `${login}/${repo}`,
		yuquePath: path.join(cwd, 'yuque.json'),
		timeout: options.timeout
	}

	const articles = await getAllArticles(config)

	articles.forEach(article => {
		const slug = mdNameFormat === 'title' ? article.title : article.slug

		const template = `---
title: ${article.title}
slug: ${slug}
date: ${article.date || formatDate(article.created_at)}
tags: ${formatArray(article.tags)}
categories: ${formatArray(article.categories)}
---

${article.body}`

		const yuqueDocNode = {
			...article,
			id: createNodeId(`yuque-doc-${article.id}`),
			parent: null,
			children: [],
			internal: {
				type: 'YuqueDoc',
				mediaType: 'text/markdown',
				content: template,
				contentDigest: createContentDigest(article)
			}
		}
		createNode(yuqueDocNode)
	})

	return
}
