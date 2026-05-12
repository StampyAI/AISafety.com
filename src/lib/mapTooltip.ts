interface PositionTooltipOptions {
  minLeftMargin?: number
}

export function positionTooltip(
  cursorX: number,
  cursorY: number,
  tt: HTMLDivElement,
  container: HTMLDivElement,
  options: PositionTooltipOptions = {}
) {
  const mapRect = container.getBoundingClientRect()
  const tooltipWidth = tt.offsetWidth
  const tooltipHeight = tt.offsetHeight
  const offset = 15

  let finalY: number
  const spaceBelow = mapRect.bottom - (cursorY + offset)
  const spaceAbove = cursorY - offset - mapRect.top
  if (spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove) {
    finalY = cursorY + offset
    if (finalY + tooltipHeight > mapRect.bottom)
      finalY = mapRect.bottom - tooltipHeight - 2
  } else {
    finalY = cursorY - offset - tooltipHeight
    if (finalY < mapRect.top) finalY = mapRect.top + 2
  }

  let finalX: number
  const spaceRight = mapRect.right - (cursorX + offset)
  const spaceLeft = cursorX - offset - mapRect.left
  if (spaceRight >= tooltipWidth || spaceRight >= spaceLeft) {
    finalX = cursorX + offset
    if (finalX + tooltipWidth > mapRect.right)
      finalX = mapRect.right - tooltipWidth - 2
  } else {
    finalX = cursorX - offset - tooltipWidth
    if (finalX < mapRect.left) finalX = mapRect.left + 2
  }

  if (options.minLeftMargin !== undefined && finalX < options.minLeftMargin) {
    finalX = options.minLeftMargin
  }

  tt.style.left = finalX + 'px'
  tt.style.top = finalY + 'px'
}
