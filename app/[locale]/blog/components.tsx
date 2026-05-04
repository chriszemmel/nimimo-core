import type { BlogSection } from "./lib"

export function ArticleRenderer({ sections }: { sections: BlogSection[] }) {
  return (
    <div className="space-y-6">
      {sections.map((section, i) => (
        <Section key={i} section={section} />
      ))}
    </div>
  )
}

function Section({ section }: { section: BlogSection }) {
  switch (section.type) {
    case "paragraph":
      return (
        <p className="text-base text-muted-foreground leading-relaxed">
          {section.content}
        </p>
      )

    case "heading":
      if (section.level === 3) {
        return (
          <h3 className="text-xl sm:text-2xl font-semibold text-foreground pt-4">
            {section.content}
          </h3>
        )
      }
      return (
        <h2 className="text-2xl sm:text-3xl font-semibold text-foreground pt-6">
          {section.content}
        </h2>
      )

    case "list":
      return (
        <ul className="list-disc list-inside space-y-2 text-base text-muted-foreground ml-4">
          {section.items?.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )

    case "code":
      return (
        <pre className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-foreground font-mono">
            {section.content}
          </code>
        </pre>
      )

    case "callout":
      return (
        <div
          className={`border-l-4 pl-4 py-3 ${
            section.variant === "warning"
              ? "border-yellow-500/60 bg-yellow-500/5"
              : "border-primary/60 bg-primary/5"
          } rounded-r-lg`}
        >
          <p className="text-base text-foreground leading-relaxed">
            {section.content}
          </p>
        </div>
      )

    case "quote":
      return (
        <blockquote className="border-l-4 border-border pl-4 py-2">
          <p className="text-base text-muted-foreground italic leading-relaxed">
            {section.content}
          </p>
          {section.attribution && (
            <cite className="text-sm text-muted-foreground mt-2 block not-italic">
              - {section.attribution}
            </cite>
          )}
        </blockquote>
      )

    default:
      return null
  }
}
