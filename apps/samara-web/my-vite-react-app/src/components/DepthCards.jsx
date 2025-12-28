import PropTypes from "prop-types";

export default function DepthCards({ items }) {
  if (!items?.length) return null;

  const [main, ...background] = items; // first is main, rest are background (4–6)

  return (
    <section className="depth-cards" aria-label="Depth cards">
      <div className="depth-cards__frame">
        <div className="depth-cards__backdrop" aria-hidden="true" />

        {/* Background stack */}
        <div className="depth-cards__stack" aria-hidden="true">
          {background.slice(0, 6).map((it, idx) => (
            <div
              key={it.id}
              className="depth-card depth-card--bg"
              data-depth={idx + 1}
              style={{ backgroundImage: `url("${it.image}")` }}
            />
          ))}
        </div>

        {/* Main/front card */}
        <article className="depth-card depth-card--main">
          <div
            className="depth-card__img"
            style={{ backgroundImage: `url("${main.image}")` }}
            aria-hidden="true"
          />
          <div className="depth-card__meta">
            {main.kicker ? <div className="depth-card__kicker">{main.kicker}</div> : null}
            {main.title ? <h3 className="depth-card__title">{main.title}</h3> : null}
            {main.desc ? <p className="depth-card__desc">{main.desc}</p> : null}
          </div>
        </article>
      </div>
    </section>
  );
}

DepthCards.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      image: PropTypes.string.isRequired,
      kicker: PropTypes.string,
      title: PropTypes.string,
      desc: PropTypes.string,
    })
  ).isRequired,
};