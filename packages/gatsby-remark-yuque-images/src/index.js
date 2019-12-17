const _ = require(`lodash`)
const path = require(`path`)
const axios = require(`axios`)
const fs = require(`fs-extra`)
const crypto = require(`crypto`)
const { fluid, traceSVG } = require(`gatsby-plugin-sharp`)
const visitWithParents = require(`unist-util-visit-parents`)
const { createRemoteFileNode } = require(`gatsby-source-filesystem`)

const {
  DEFAULT_OPTIONS,
  imageClass,
  imageBackgroundClass,
  imageWrapperClass,
} = require(`./constants`)

const {
  getMaxWidth,
  isYuqueImage,
  parseYuqueImage,
  buildResponsiveSizes,
  slash
} = require(`./utils`)

// If the image is hosted on yuque
// 1. Find the image file
// 2. Find the image's size
// 3. Filter out any responsive image sizes that are greater than the image's width
// 4. Create the responsive images.
// 5. Set the html w/ aspect ratio helper.

module.exports = async ({ actions: { createNode }, files, markdownAST, cache, pathPrefix, createContentDigest, store, reporter }, pluginOptions) => {
  const options = _.defaults(pluginOptions, { pathPrefix }, DEFAULT_OPTIONS)

  const findParentLinks = ({ children }) =>
    children.some(
      node =>
        (node.type === `html` && !!node.value.match(/<a /)) ||
        node.type === `link`
    )

  const findInlineImage = ({ children }) =>
    children.some(
      (node, i) =>
        node.type == `image` &&
        children[i - 1] &&
        (children[i - 1].type == `image` || children[i - 1].type == `text`)
    )

  // This will only work for markdown syntax image tags
  const markdownImageNodes = []

  visitWithParents(markdownAST, `image`, (node, ancestors) => {
    const isInLink = ancestors.some(findParentLinks)
    const isInline = ancestors.some(findInlineImage)

    markdownImageNodes.push({
      node,
      isInLink,
      isInline
    })
  })

  // Takes a node and generates the needed images and then returns
  // the needed HTML replacement for the image
  const generateImagesAndUpdateNode = async (
    node,
    resolve,
    isInLink,
    isInline,
    yuqueImage
  ) => {
    const originalImg = yuqueImage.url
    const optionsMaxWidth = options.maxWidth
    const yuqueImgAlt = node.alt ? node.alt.split(`.`).shift() : ``

    let maxWidth = optionsMaxWidth

    isInLink = yuqueImage.styles.link || isInLink

    const optionsHash = crypto
      .createHash(`md5`)
      .update(JSON.stringify(options))
      .digest(`hex`)

    const cacheKey = `remark-images-yq-${originalImg.split(`/`)[8]}-${optionsHash}`
    const cahedRawHTML = await cache.get(cacheKey)

    if (cahedRawHTML) {
      return cahedRawHTML
    }

    try {
      const response = await axios({
        method: `GET`,
        url: `${originalImg}?x-oss-process=image/info`
      })

      const { FileSize, ImageWidth, ImageHeight } = response.data

      const metadata = {
        fileSize: +FileSize.value,
        width: +ImageWidth.value,
        height: +ImageHeight.value
      }

      const yuqueImgWidth = yuqueImage.styles.width || metadata.width
      const yuqueImgOriginalWidth =
        yuqueImage.styles.originWidth || metadata.width

      maxWidth = yuqueImgWidth >= `746`
        ? getMaxWidth(optionsMaxWidth, yuqueImgOriginalWidth)
        : getMaxWidth(optionsMaxWidth, yuqueImgWidth)

      const responsiveSizesResult = await buildResponsiveSizes({
        metadata,
        imageUrl: originalImg,
        options
      })

      // Calculate the paddingBottom %
      const ratio = `${(1 / responsiveSizesResult.aspectRatio) * 100}%`

      const fallbackSrc = originalImg
      const srcSet = responsiveSizesResult.srcSet
      const presentationWidth = responsiveSizesResult.presentationWidth

      const inlineImgStyle = `
        display: inline-block;
        width: ${maxWidth}px;
        max-width: 100%;
        vertical-align: bottom;
      `

      const imageStyle = `
        width: 100%;
        height: 100%;
        margin: 0;
        vertical-align: middle;
        position: absolute;
        top: 0;
        left: 0;`.replace(/\s*(\S+:)\s*/g, `$1`)

      // Create our base image tag
      let imageTag = `
      <img
        class="${imageClass}"
        alt="${yuqueImgAlt}"
        title="${node.title ? node.title : ``}"
        src="${fallbackSrc}"
        srcset="${srcSet}"
        sizes="${responsiveSizesResult.sizes}"
        style="${imageStyle}"
      />
   `.trim()

      // if options.withWebp is enabled, add a webp version and change the image tag to a picture tag
      if (options.withWebp) {
        imageTag = `
        <picture>
          <source
            srcset="${responsiveSizesResult.webpSrcSet}"
            sizes="${responsiveSizesResult.sizes}"
            type="image/webp"
          />
          <source
            srcset="${srcSet}"
            sizes="${responsiveSizesResult.sizes}"
          />
          <img
            class="${imageClass}"
            src="${fallbackSrc}"
            alt="${yuqueImgAlt}"
            title="${node.title ? node.title : ``}"
            style="${imageStyle}"
          />
        </picture>
      `.trim()
      }

      // Construct new image node w/ aspect ratio placeholder
      let rawHTML = `
        <span
          class="${imageBackgroundClass}"
          style="padding-bottom: ${ratio}; position: relative; bottom: 0; left: 0; background-image: url('${
        responsiveSizesResult.bg
        }'); background-size: cover; display: block;"
        ></span>
        ${imageTag}
      `.trim()

      // Make linking to original image optional.
      if (!isInLink && options.linkImagesToOriginal) {
        rawHTML = `
          <a
            class="gatsby-resp-image-link"
            href="${originalImg}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${rawHTML}
          </a>
      `.trim()
      } else if (yuqueImage.styles.link) {
        // Make linking to the giving link.
        rawHTML = `
          <a
            class="gatsby-resp-image-link"
            href="${yuqueImage.styles.link}"
            style="display: block"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${rawHTML}
          </a>
        `.trim()
      }

      rawHTML = `
        <span
          class="${imageWrapperClass}"
          style="position: relative; display: block; max-width: ${maxWidth}px; margin-left: auto; margin-right: auto; ${
        isInline ? inlineImgStyle : ``
        }${options.wrapperStyle}"
        >
          ${rawHTML}
        </span>
      `.trim()

      await cache.set(cacheKey, rawHTML)
      return rawHTML
    } catch (error) {
      reporter.error(error)
      return null
    }
  }

  const fetchImagesAndUpdateNode = async (
    node,
    resolve,
    isInLink,
    isInline,
    yuqueImage
  ) => {
    const imageDir = path.join(store.getState().program.directory, `static/${options.imageDir}`, yuqueImage.folder)
    const pluginCacheDir = path.join(store.getState().program.directory, `.cache/gatsby-source-filesystem`)

    const imagePath = slash(path.join(imageDir, yuqueImage.filename))
    const cacheImagePath = slash(path.join(pluginCacheDir, createContentDigest(yuqueImage.url), yuqueImage.filename))

    // Ensure our image directory exists.
    await fs.ensureDir(imageDir)

    let imageNode
    if (fs.existsSync(imagePath)) {
      imageNode = _.find(files, file => {
        if (file && file.absolutePath) {
          return file.absolutePath === imagePath
        }
        return null
      })
    } else {
      imageNode = await createRemoteFileNode({
        url: yuqueImage.url,
        store,
        cache,
        createNode,
        createNodeId: createContentDigest,
        reporter,
      })
      await fs.copyFileSync(cacheImagePath, imagePath)
    }

    if (!imageNode || !imageNode.absolutePath) {
      return resolve()
    }

    const finalImagePath = `/${options.imageDir}/${yuqueImage.folder}/${imageNode.base}`

    const optionsMaxWidth = options.maxWidth

    let maxWidth = optionsMaxWidth

    const yuqueImgWidth = yuqueImage.styles.width
    const yuqueImgOriginalWidth = yuqueImage.styles.originWidth

    if (yuqueImgWidth) {
      maxWidth = yuqueImgWidth >= `746`
        ? getMaxWidth(optionsMaxWidth, yuqueImgOriginalWidth)
        : getMaxWidth(optionsMaxWidth, yuqueImgWidth)
    } else {
      maxWidth = ``
    }

    const imageStyle = maxWidth ? `
          width: ${maxWidth}px;
        `.trim() : ``

    return `
      <img src="${finalImagePath}" style="${imageStyle}"/>
    `
  }

  return Promise.all(
    markdownImageNodes.map(
      ({ node, isInLink, isInline }) =>
        // eslint-disable-next-line no-async-promise-executor
        new Promise(async (resolve, reject) => {
          if (isYuqueImage(node.url)) {
            const yuqueImage = parseYuqueImage(node.url)
            const fileType = yuqueImage.ext

            if (options.local) {
              const rawHTML = await fetchImagesAndUpdateNode(
                node,
                resolve,
                isInLink,
                isInline,
                yuqueImage
              )

              if (rawHTML) {
                // Replace the image node with an inline HTML node.
                node.type = `html`
                node.value = rawHTML
              }

              return resolve(node)
            } else if (fileType !== `gif` && fileType !== `svg`) {
              const rawHTML = await generateImagesAndUpdateNode(
                node,
                resolve,
                isInLink,
                isInline,
                yuqueImage
              )

              if (rawHTML) {
                // Replace the image node with an inline HTML node.
                node.type = `html`
                node.value = rawHTML
              }

              return resolve(node)
            } else {
              return resolve()
            }
          } else {
            // Image isn't from yuque so there's nothing for us to do.
            return resolve()
          }
        })
    )
  )
}
