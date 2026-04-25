import { Card } from "@/components/ui/card";

type ScreenPlaceholderProps = {
  title: string;
  description: string;
  bullets: string[];
};

export function ScreenPlaceholder({
  title,
  description,
  bullets
}: ScreenPlaceholderProps) {
  return (
    <section className="screen-section">
      <div className="screen-copy">
        <h1 className="screen-title">{title}</h1>
        <p className="screen-description">{description}</p>
      </div>

      <Card title="Что появится в следующих фазах">
        <ul className="bullet-list">
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
