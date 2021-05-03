interface RenderOptions {
  gray: boolean,
  maxValue: number
  line?: boolean,
  fill?: boolean,
  bar?: boolean,
}

interface SvgOptions {
  width: number,
  maxHeight: number,
  lineWidth?: number,
  color?: string,
  fill?: boolean,
  fillGray?: boolean
}

const MAX_VALUES_SIZE = 100

const colors = [
  '#C6E48B', // 薄い
  '#7BC96F',
  '#239A3B',
  '#196127' // 濃い (固定最大値を振り切ったとき専用)
]

const polylineColors = [
  '#196127'
]

const renderRects = (heights: number[], options: SvgOptions) => {
  const { width, maxHeight } = options
  const w = width
  const svgRects = []
  for (let [idx, height] of heights.entries()) {
    let fill = colors[0]
    if (height >= maxHeight) { // 振り切った
      height = maxHeight
      fill = colors[3]
    } else if (height >= 0.8 * maxHeight) {
      fill = colors[2]
    } else if (height >= 0.5 * maxHeight) {
      fill = colors[1]
    }
    svgRects.push(`<rect x="${idx * w}" y="${maxHeight + 1 - height}" width="${w}" height="${height}" fill="${fill}" />`)
  }
  return svgRects
}

const renderPolyline = (heights: number[], options: SvgOptions) => {
  const { width, maxHeight, lineWidth, color, fill, fillGray } = options
  const points = []
  const r = lineWidth! / 2
  // 始点と終点の管理
  const beginPoint = []
  const endPoint = []
  for (let [idx, height] of heights.entries()) {
    if (height >= maxHeight - r) { // 振り切った
      height = maxHeight - r
    }
    const x = r + width * idx
    const y = maxHeight + r - height
    points.push(`${x},${y}`)

    if (idx === 0) {
      beginPoint.push(x)
      beginPoint.push(y)
    } else if (idx === heights.length - 1) {
      endPoint.push(x)
      endPoint.push(y)
    }
  }
  if (fill && beginPoint.length === 2 && endPoint.length === 2) {
    points.push(`${endPoint[0]},${maxHeight}`)
    points.push(`${beginPoint[0]},${maxHeight}`)
    points.push(`${beginPoint[0]},${beginPoint[1]}`)
  }
  const pointsValue = points.join(' ')

  if (fill) {
    // ゼロラインと折れ線チャートの囲む領域を着色する
    const fillColor = fillGray ? '#d9d9d9' : color
    return [
      // 底辺の角が丸みをお帯びているので長方形を重ねる
      `<line x1="${beginPoint[0]}" y1="${maxHeight}" x2="${endPoint[0]}" y2="${maxHeight}" fill="${fillColor}" ` +
      ` stroke="${fillColor}" stroke-width="${lineWidth}" stroke-linecap="square" stroke-linejoin="square" />`,
      `<polyline fill="${fillColor}" stroke-linejoin="round" stroke-linecap="round"` +
      ` stroke="${fillColor}" stroke-width="${lineWidth}" points="${pointsValue}" />`,
    ]
  } else {
    return [
      `<polyline fill="none" stroke-linejoin="round" stroke-linecap="round"` +
      ` stroke="${color}" stroke-width="${lineWidth}" points="${pointsValue}" />`
    ]
  }
}

const parseOptions = (options: RenderOptions) => {
  const { bar, line, fill, gray, maxValue } = options

  const chartOptions: RenderOptions = {
    maxValue: maxValue || 100,
    gray
  }

  chartOptions.fill = fill
  if (!bar && !line) chartOptions.bar = true
  if (bar) {
    chartOptions.bar = true
    chartOptions.fill = false
  }
  if (line) {
    chartOptions.line = true
  }

  return chartOptions
}

const createSvgText = (values: number[] = [], options: RenderOptions) => {
  const chartOptions = parseOptions(options)

  const maxHeight = 15
  const heights = values.map(value => {
    const v = Math.floor(value) / chartOptions.maxValue
    return v * maxHeight
  }).slice(0, MAX_VALUES_SIZE)

  const svgLines = chartOptions.line
    ? renderPolyline(heights, {
      maxHeight,
      lineWidth: 2,
      width: 3,
      color: polylineColors[0]
    })
    : []

  // Lines with fill
  const svgFill = chartOptions.fill
    ? renderPolyline(heights, {
      maxHeight,
      lineWidth: 2,
      width: 3,
      color: colors[0],
      fill: true,
      fillGray: chartOptions.gray
    })
    : []

  const svgRects = chartOptions.bar
    ? renderRects(heights, {
      maxHeight,
      width: 3
    })
    : []

  const grayScaleSettings = []
  if (chartOptions.gray) {
    grayScaleSettings.push(...[
      '<defs>',
      '<filter id="gray">',
      '<feColorMatrix type="saturate" values="0" />',
      '</filter>',
      '</defs>',
      '<style type="text/css">',
      '<![CDATA[',
      'rect, polyline { filter: url(#gray); }',
      ']]>',
      '</style>'
    ])
  }

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"',
    ' version = "1.1"',
    ' viewBox="0 0 90 20"',
    ' width="90"',
    ' height="20">',
    ...grayScaleSettings,
    ...svgFill,
    ...svgRects,
    ...svgLines,
    '</svg>'
  ].join('')
}

function handleRequest(values: number[], options: RenderOptions) {
  const headers = {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'no-store'
  }
  const data = createSvgText(values, options)
  return new Response(data, { headers })
}

addEventListener('fetch', event => {
  const req = event.request
  const params = (new URL(req.url)).searchParams
  const values = (params.get('values') || '')
    .split(',')
    .map(v => +v.trim())
    .filter(v => Number.isFinite(v))
  const options: RenderOptions = {
    line: params.get('line') === '1',
    fill: params.get('fill') === '1',
    bar: params.get('bar') === '1',
    gray: params.get('gray') === '1',
    maxValue: +(params.get('maxValue') || 0),
  }
  event.respondWith(handleRequest(values, options))
})
