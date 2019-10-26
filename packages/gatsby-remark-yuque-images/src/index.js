const _ = require(`lodash`)
const path = require(`path`)
const fs = require(`fs-extra`)
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
  slash
} = require(`./utils`)

// If the image is hosted on yuque
// 1. Download image to local
// 2. Find the image file
// 3. Find the image's size
// 4. Filter out any responsive image sizes that are greater than the image's width
// 5. Create the responsive images.
// 6. Set the html w/ aspect ratio helper.

module.exports = async ({ actions: { createNode }, files, markdownAST, pathPrefix, createContentDigest, store, cache, reporter }, pluginOptions) => {
  const options = _.defaults(pluginOptions, { pathPrefix }, DEFAULT_OPTIONS)

  const findParentLinks = ({ children }) =>
    children.some(
      node =>
        (node.type === `html` && !!node.value.match(/<a /)) ||
        node.type === `link`
    )

  // const findInlineImage = ({ children }) =>
  //   children.some(
  //     (node, i) =>
  //       node.type == `image` &&
  //       children[i - 1] &&
  //       (children[i - 1].type == `image` || children[i - 1].type == `text`)
  //   )
  const findInlineImage = ({ children }) => false

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
    const imageDir = path.join(store.getState().program.directory, options.imageDir, yuqueImage.folder)
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

    const fluidResult = await fluid({
      file: imageNode,
      args: options,
      reporter,
      cache,
    })

    if (!fluidResult) {
      return resolve()
    }

    const originalImg = yuqueImage.url
    const { src: fallbackSrc, srcSet, presentationWidth } = fluidResult

    const optionsMaxWidth = options.maxWidth
    const yuqueImgAlt = node.alt ? node.alt.split(`.`).shift() : ``

    let maxWidth = optionsMaxWidth

    isInLink = yuqueImage.styles.link || isInLink

    const yuqueImgWidth = yuqueImage.styles.width || presentationWidth
    const yuqueImgOriginalWidth = yuqueImage.styles.originWidth || presentationWidth

    maxWidth = yuqueImgWidth >= `746`
      ? getMaxWidth(optionsMaxWidth, yuqueImgOriginalWidth)
      : getMaxWidth(optionsMaxWidth, yuqueImgWidth)

    const inlineImgStyle = `
        display: inline-block;
        width: ${maxWidth}px;
        vertical-align: top;
      `

    // Create our base image tag
    let imageTag = `
      <img
        class="${imageClass}"
        alt="${yuqueImgAlt}"
        title="${node.title ? node.title : ``}"
        src="${fallbackSrc}"
        srcset="${srcSet}"
        sizes="${fluidResult.sizes}"
      />
   `.trim()

    // if options.withWebp is enabled, add a webp version and change the image tag to a picture tag
    if (options.withWebp) {
      const webpFluidResult = await fluid({
        file: imageNode,
        args: _.defaults(
          { toFormat: `WEBP` },
          // override options if it's an object, otherwise just pass through defaults
          options.withWebp === true ? {} : options.withWebp,
          pluginOptions,
          DEFAULT_OPTIONS
        ),
        reporter,
      })

      if (!webpFluidResult) {
        return resolve()
      }

      imageTag = `
        <picture>
          <source
            srcset="${webpFluidResult.srcSet}"
            sizes="${webpFluidResult.sizes}"
            type="${webpFluidResult.srcSetType}"
          />
            <source
            srcset="${srcSet}"
            sizes="${fluidResult.sizes}"
            type="${fluidResult.srcSetType}"
          />
          <img
            class="${imageClass}"
            src="${fallbackSrc}"
            alt="${yuqueImgAlt}"
            title="${node.title ? node.title : ``}"
          />
        </picture>
      `.trim()
    }

    let placeholderImageData = fluidResult.base64

    // if options.tracedSVG is enabled generate the traced SVG and use that as the placeholder image
    if (options.tracedSVG) {
      let args = typeof options.tracedSVG === `object` ? options.tracedSVG : {}

      // Translate Potrace constants (e.g. TURNPOLICY_LEFT, COLOR_AUTO) to the values Potrace expects
      const { Potrace } = require(`potrace`)
      const argsKeys = Object.keys(args)
      args = argsKeys.reduce((result, key) => {
        const value = args[key]
        // eslint-disable-next-line no-prototype-builtins
        result[key] = Potrace.hasOwnProperty(value) ? Potrace[value] : value
        return result
      }, {})

      const tracedSVG = await traceSVG({
        file: imageNode,
        args,
        fileArgs: args,
        cache,
        reporter,
      })

      // Escape single quotes so the SVG data can be used in inline style attribute with single quotes
      placeholderImageData = tracedSVG.replace(/'/g, `\\'`)
    }

    const ratio = `${(1 / fluidResult.aspectRatio) * 100}%`

    const wrapperStyle =
      typeof options.wrapperStyle === `function`
        ? options.wrapperStyle(fluidResult)
        : options.wrapperStyle

    let rawHTML = `
        <span
          class="${imageBackgroundClass}"
          style="padding-bottom: ${ratio}; position: relative; bottom: 0; left: 0; background-image: url('${placeholderImageData}'); background-size: cover; display: block;"
        ></span>
        ${imageTag}
      `.trim()

    // Make linking to original image optional.
    if (!isInLink && options.linkImagesToOriginal) {
      rawHTML = `
          <a
            class="gatsby-resp-image-link"
            href="${originalImg}"
            style="display: ${isInline ? `inline-block` : `block`}"
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
      }${wrapperStyle}"
        >
          ${rawHTML}
        </span>
      `.trim()

    return rawHTML
  }

  return Promise.all(
    markdownImageNodes.map(
      ({ node, isInLink, isInline }) =>
        // eslint-disable-next-line no-async-promise-executor
        new Promise(async (resolve, reject) => {
          if (isYuqueImage(node.url)) {
            const yuqueImage = parseYuqueImage(node.url)
            const fileType = yuqueImage.ext

            if (fileType !== `gif` && fileType !== `svg`) {
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
