export function getMaxWidth(optionsMaxWidth, imageWidth) {
  return optionsMaxWidth > imageWidth ? imageWidth : optionsMaxWidth
}

export function isYuqueImage(url) {
  return /https:\/\/cdn.(yuque|nlark).com\/yuque/.test(url)
}

export function parseYuqueImage(link) {
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

export function paramsToObject(params) {
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
export function slash(path) {
  const isExtendedLengthPath = /^\\\\\?\\/.test(path)

  if (isExtendedLengthPath) {
    return path
  }

  return path.replace(/\\/g, `/`)
}
