import marpitPlugin from '@marp-team/marpit/lib/markdown/marpit_plugin'
import fittingCSS from './fitting.scss'
import { Marp } from '../marp'

export const css = fittingCSS
export const attr = 'data-marp-fitting'
export const code = 'data-marp-fitting-code'
export const math = 'data-marp-fitting-math'
export const svgContentAttr = 'data-marp-fitting-svg-content'
export const svgContentWrapAttr = 'data-marp-fitting-svg-content-wrap'

export type ThemeResolver = () => string | undefined

function wrapTokensByFittingToken(token, tokens: any[]): any[] {
  const open = new token('marp_fitting_open', 'span', 1)
  open.attrSet(attr, 'plain')

  return [open, ...tokens, new token('marp_fitting_close', 'span', -1)]
}

// Wrap code block and fence renderer by fitting elements.
function fittingCode(md, themeResolver: ThemeResolver): void {
  const { code_block, fence } = md.renderer.rules

  const codeMatcher = /^(<pre[^>]*?><code[^>]*?>)([\s\S]*)(<\/code><\/pre>\n*)$/

  const replacedRenderer = func => (...args) => {
    const rendered: string = func(...args)

    const { fittingCode } = md.marpit.themeSet.getThemeProp(
      themeResolver()!,
      'meta'
    )
    if (fittingCode === 'false') return rendered

    return rendered.replace(codeMatcher, (_, start, content, end) => {
      if (md.marpit.options.inlineSVG) {
        return [
          `${start}<svg ${attr}="svg" ${code}><foreignObject>`,
          `<span ${svgContentAttr}><span ${svgContentWrapAttr}>`,
          content,
          `</span></span></foreignObject></svg>${end}`,
        ].join('')
      }
      return `${start}<span ${attr}="plain">${content}</span>${end}`
    })
  }

  md.renderer.rules.code_block = replacedRenderer(code_block)
  md.renderer.rules.fence = replacedRenderer(fence)
}

// Detect `<!-- fit -->` comment keyword in headings.
function fittingHeader(md): void {
  md.core.ruler.after('inline', 'marp_fitting_header', state => {
    let target = undefined

    for (const token of state.tokens) {
      if (!target && token.type === 'heading_open') target = token

      if (target) {
        if (token.type === 'inline') {
          let requireWrapping = false

          for (const t of token.children) {
            if (t.type === 'marpit_comment' && t.content === 'fit') {
              requireWrapping = true
              t.meta = t.meta || {}
              t.meta.marpitCommentParsed = 'marp-fitting-header'
            }
          }

          if (requireWrapping) {
            token.children = wrapTokensByFittingToken(
              state.Token,
              token.children
            )
          }
        } else if (token.type === 'heading_close') {
          target = undefined
        }
      }
    }
  })

  if (md.marpit.options.inlineSVG) {
    Object.assign(md.renderer.rules, {
      marp_fitting_open: () =>
        `<svg ${attr}="svg"><foreignObject><span ${svgContentAttr}>`,
      marp_fitting_close: () => '</span></foreignObject></svg>',
    })
  }
}

function fittingMathBlock(md): void {
  const { marp_math_block } = md.renderer.rules
  if (!marp_math_block) return

  const replacedRenderer = func => (...args) => {
    // Rendered math block is wrapped by `<p>` tag in math plugin
    const katex: string = func(...args).slice(3, -4)

    if (md.marpit.options.inlineSVG) {
      return [
        `<p><svg ${attr}="svg" ${math}><foreignObject>`,
        `<span ${svgContentAttr}><span ${svgContentWrapAttr}>`,
        katex,
        `</span></span></foreignObject></svg></p>`,
      ].join('')
    }
    return `<p><span ${attr}="plain">${katex}</span></p>`
  }

  md.renderer.rules.marp_math_block = replacedRenderer(marp_math_block)
}

export const markdown = marpitPlugin((md, themeResolver: ThemeResolver) => {
  md.use(fittingHeader)
  md.use(fittingCode, themeResolver)
  md.use(fittingMathBlock)
})
