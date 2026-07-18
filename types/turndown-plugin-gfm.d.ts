declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown'
  export function gfm(turndown: TurndownService): TurndownService
  const tables: (turndown: TurndownService) => TurndownService
  const strikethrough: (turndown: TurndownService) => TurndownService
  const taskListItems: (turndown: TurndownService) => TurndownService
  export { tables, strikethrough, taskListItems }
}
