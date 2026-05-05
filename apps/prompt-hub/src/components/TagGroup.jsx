export default function TagGroup({ title, group, tags, selected, onToggle, single = false, green = false }) {
  return (
    <div className="sgroup">
      <div className="sgroup-title">{title}</div>
      <div className="tgrid">
        {tags.map(tag => (
          <div
            key={tag}
            className={`tag${green ? ' g' : ''}${tags.length > 6 ? ' big' : ''}${selected.includes(tag) ? ' on' : ''}`}
            onClick={() => onToggle(group, tag, single)}
          >
            {tag}
          </div>
        ))}
      </div>
    </div>
  )
}
