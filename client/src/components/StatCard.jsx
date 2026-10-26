import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faHourglassHalf, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'

function StatCard({ label, value, tone }) {
  const icon = { pending: faHourglassHalf, done: faCircleCheck, risk: faTriangleExclamation }[tone]
  return (
    <div className={`stat-card stat-${tone}`}>
      <dt>
        <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" /> {label}:
      </dt>
      <dd>{value}</dd>
    </div>
  )
}

export default StatCard
