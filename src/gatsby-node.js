const path = require('path')
const process = require('process')
const { createRemoteFileNode } = require('gatsby-source-filesystem')
const cwd = process.cwd()

const getAllArticles = require('./download')
const { formatDate, formatArray } = require('./utils')

exports.onCreateNode = async (
	{
		actions: { createNode },
		node,
		createContentDigest,
		store,
		cache,
		reporter,
	}
) => {
	if (node.internal.type === 'YuqueDoc' && node.cover) {
		const fileNode = await createRemoteFileNode({
			url: node.cover,
			store,
			cache,
			createNode,
			createNodeId: createContentDigest,
			reporter,
		})

		if (fileNode) {
			node.cover___NODE = fileNode.id
		}
	}
}

exports.sourceNodes = async (context, pluginOptions) => {
	const {
		actions: { createNode },
		createNodeId,
		createContentDigest
	} = context

	const {
		baseUrl = 'https://www.yuque.com/api/v2/',
		login = '',
		repo = '',
		mdNameFormat = 'title',
		timeout = 10000
	} = pluginOptions

	delete pluginOptions.plugins

	if (!login || !repo) {
		return
	}

	const config = {
		namespace: `${login}/${repo}`,
		yuquePath: path.join(cwd, 'yuque.json'),
		baseUrl,
		timeout
	}

	const articles = await getAllArticles(context, config)

	articles.forEach(article => {
		const slug = mdNameFormat === 'title' ? article.title : article.slug

		const template = `---
title: ${article.title.replace(/^@/, '')}
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
