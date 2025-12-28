
export default function Button({ label, css = "btn", style, action, onClick }) {
  async function handleClick(e) {
    if (onClick) return onClick(e);
    if (!action) return;
    e.preventDefault();
    try {
      await callEndpoint(action);
      // handle success UI here (toast, state update, etc.)
    } catch (err) {
      // handle error UI here
      console.error(err);
    }
  }

  return (
    <button className={css} style={style} onClick={handleClick}>
      {label}
    </button>
  );
}
