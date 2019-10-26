# gatsby-remark-yuque-images

[![NPM version][npm-image]][npm-url]
[![LICENSE version][license-image]][license-url]

[npm-image]: https://img.shields.io/npm/v/gatsby-remark-yuque-images.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/gatsby-remark-yuque-images
[license-image]: https://img.shields.io/github/license/Raincal/gatsby-remark-yuque-images.svg?style=flat-square
[license-url]: https://github.com/Raincal/gatsby-remark-yuque-images/blob/master/LICENSE

Processes images from [语雀](https://www.yuque.com).

## Install

`npm install --save gatsby-remark-yuque-images`

## How to use

```javascript
// In your gatsby-config.js
plugins: [
  {
    resolve: `gatsby-transformer-remark`,
    options: {
      plugins: [
        {
          resolve: `gatsby-remark-yuque-images`,
          options: {
            maxWidth: 746
          }
        }
      ]
    }
  }
]
```

## Options

| Name                   | Default          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxWidth`             | `746`            | The `maxWidth` in pixels of the `img` where the markdown will be displayed.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `linkImagesToOriginal` | `true`           | Add a link to each image to the original image. Sometimes people want to see a full-sized version of an image e.g. to see extra detail on a part of the image and this is a convenient and common pattern for enabling this. Set this option to false to disable this behavior.                                                                                                                                                                                             |
| `wrapperStyle`         |                  | Add custom styles to the div wrapping the responsive images. Use regular CSS syntax, e.g. `margin-bottom:10px;`                                                                                                                                                                                                                                                                                                                                                             |
| `backgroundColor`      | `white`          | Set the background color of the image to match the background image of your design                                                                                                                                                                                                                                                                                                                                                                                          |
| `withWebp`             | `false`          | Additionally add WebP versions alongside your chosen file format. They are added as a srcset with the appropriate mimetype and will be loaded in browsers that support the format.Pass `true` for default support, or an object of options to specifically override those for the WebP files. For example, pass `{ quality: 80 }` to have the WebP images be at quality level 80.                                                                                           |
| `tracedSVG`            | `false`          | Use traced SVGs for placeholder images instead of the "blur up" effect. Pass `true` for traced SVGs with the default settings (seen [here][3]), or an object of options to override the defaults. For example, pass `{ color: "#F00", turnPolicy: "TURNPOLICY_MAJORITY" }` to change the color of the trace to red and the turn policy to TURNPOLICY_MAJORITY. See [`node-potrace` parameter documentation][4] for a full listing and explanation of the available options. |
| `imageDir`             | `content/static` | Set the download location of yuque images                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## LICENSE

[MIT](https://github.com/Raincal/gatsby-remark-yuque-images/blob/master/LICENSE)
