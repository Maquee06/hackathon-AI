export default function ConnectionBar({ status, text }) {
  return (
    <div className={`conn-bar ${status}`} id="connBar">
      <div className="conn-dot" />
      <span id="connText">{text}</span>
    </div>
  );
}
