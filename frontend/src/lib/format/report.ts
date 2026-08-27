import type { CreateReportBody, ListReports200ResultsItem } from '@/api/models'

type Category = CreateReportBody['category']

/**
 * German labels for the report categories, one place so the dialog and the operators' queue
 * agree. Ordered as they are offered, which is not the enum's alphabetical order: the ones
 * somebody reaches for most stand first, and „Etwas anderes" stands last because a list that
 * ends in it reads as "and otherwise, say so yourself".
 *
 * Two of these have no counterpart on other platforms and both come from what Calliope is.
 * Violence and sexual content are ordinary subject matter for fiction, so the reportable
 * failure is usually that they were not declared — that is `missing_content_warning`, and it
 * points at the content-warning field rather than at a rule. And `plagiarism` is among the
 * likeliest real reports on a site where people publish prose.
 */
export const REPORT_CATEGORIES: ReadonlyArray<{ value: Category; label: string }> = [
  { value: 'harassment', label: 'Belästigung oder Mobbing' },
  { value: 'hate', label: 'Hass oder Herabwürdigung' },
  { value: 'violence', label: 'Gewalt oder Drohung' },
  { value: 'sexual_content', label: 'Sexuelle Inhalte' },
  { value: 'self_harm', label: 'Selbstverletzung oder Suizid' },
  { value: 'illegal_content', label: 'Illegale Inhalte' },
  { value: 'missing_content_warning', label: 'Fehlende Inhaltswarnung' },
  { value: 'plagiarism', label: 'Plagiat oder Urheberrecht' },
  { value: 'spam', label: 'Spam oder Werbung' },
  { value: 'legal_issue', label: 'Rechtliches Problem' },
  { value: 'other', label: 'Etwas anderes' },
]

export const REPORT_CATEGORY_LABELS: Record<Category, string> = Object.fromEntries(
  REPORT_CATEGORIES.map((category) => [category.value, category.label]),
) as Record<Category, string>

type Outcome = NonNullable<ListReports200ResultsItem['closingOutcome']>

/**
 * German labels for how a closing turned out. Ordered as they are offered rather than
 * alphabetically, and grouped: the outcomes that upheld the report stand first, the ones that
 * refused it after, and „Etwas anderes" last — the same shape the categories above use, because an
 * operator closing a report is answering the list a member chose from.
 *
 * The order has to live here. Postgres sorts an enum by declaration, but `kysely-codegen` sorts
 * these alphabetically on the way into the generated client, so the document says nothing about
 * which of these an operator reaches for most.
 */
export const REPORT_OUTCOMES: ReadonlyArray<{ value: Outcome; label: string }> = [
  { value: 'content_removed', label: 'Inhalt entfernt' },
  { value: 'account_banned', label: 'Konto gesperrt' },
  { value: 'warning_given', label: 'Verwarnung ausgesprochen' },
  { value: 'content_warning_added', label: 'Inhaltswarnung ergänzt' },
  { value: 'no_violation', label: 'Kein Regelverstoß' },
  { value: 'duplicate', label: 'Doppelte Meldung' },
  { value: 'insufficient_information', label: 'Zu wenig Angaben' },
  { value: 'target_gone', label: 'Inhalt war schon gelöscht' },
  { value: 'other', label: 'Etwas anderes' },
]

export const REPORT_OUTCOME_LABELS: Record<Outcome, string> = Object.fromEntries(
  REPORT_OUTCOMES.map((outcome) => [outcome.value, outcome.label]),
) as Record<Outcome, string>
