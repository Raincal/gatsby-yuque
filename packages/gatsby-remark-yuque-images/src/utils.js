const buildResponsiveSizes = async ({ metadata, imageUrl, options = {} }) => {
  const { fileSize, width, height } = metadata
  const aspectRatio = width / height
  const pixelRatio = 1

  const presentationWidth = Math.max(
    options.maxWidth,
    Math.round(width / pixelRatio)
  )
  const presentationHeight = Math.round(presentationWidth * (height / width))

  const sizes = `(max-width: ${presentationWidth}px) 100vw, ${presentationWidth}px`

  const images = []

  images.push(metadata.width / 4)
  images.push(metadata.width / 2)
  images.push(metadata.width)
  images.push(metadata.width * 1.5)
  images.push(metadata.width * 2)
  images.push(metadata.width * 3)

  const filteredSizes = images.filter(size => size < width)

  filteredSizes.push(width)

  const bgImg = `${imageUrl}?x-oss-process=image/resize,w_20`

  const srcSet = filteredSizes
    .map(
      size =>
        `${imageUrl}?x-oss-process=image/resize,w_${Math.round(
          size
        )} ${Math.round(size)}w`
    )
    .join(`,\n`)

  const webpSrcSet = filteredSizes
    .map(size =>
      options.withWebp.quality && fileSize > 10000
        ? `${imageUrl}?x-oss-process=image/resize,w_${Math.round(
          size
        )}/format,webp/quality,q_${options.withWebp.quality} ${Math.round(
          size
        )}w`
        : `${imageUrl}?x-oss-process=image/resize,w_${Math.round(
          size
        )}/format,webp ${Math.round(size)}w`
    )
    .join(`,\n`)

  return {
    // background image
    bg: bgImg,
    aspectRatio,
    srcSet,
    webpSrcSet,
    src: imageUrl,
    sizes,
    presentationWidth,
    presentationHeight
  }
}

const getMaxWidth = (optionsMaxWidth, imageWidth) => {
  return optionsMaxWidth > imageWidth ? imageWidth : optionsMaxWidth
}

const isYuqueImage = url => {
  return /https:\/\/cdn.(yuque|nlark).com\/yuque/.test(url)
}

const parseYuqueImage = link => {
  let [url, params] = link.split(`#`)
  url = url.includes(`x-oss-process`) ? url.split(`?`).shift() : url
  const ext = url.split(`.`).pop()
  const splitUrl = url.split(`/`)
  const filename = splitUrl.pop()
  const folder = splitUrl.pop()
  const styles = paramsToObject(params)
  return {
    url,
    folder,
    filename,
    ext,
    styles
  }
}

const paramsToObject = params => {
  if (!params) return {}
  return params.split(`&`).reduce((acc, cur) => {
    const [key, val] = cur.split(`=`)
    acc[key] = val
    return acc
  }, {})
}

/**
 * slash
 * --
 * Convert Windows backslash paths to slash paths: foo\\bar ➔ foo/bar
 *
 *
 * @param  {String}          path
 * @return {String}          slashed path
 */
const slash = path => {
  const isExtendedLengthPath = /^\\\\\?\\/.test(path)

  if (isExtendedLengthPath) {
    return path
  }

  return path.replace(/\\/g, `/`)
}

module.exports = {
  buildResponsiveSizes,
  getMaxWidth,
  isYuqueImage,
  parseYuqueImage,
  slash
}