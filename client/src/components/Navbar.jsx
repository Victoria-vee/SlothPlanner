import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBars,
  faBrain,
  // faCalendarCheck,
  // faClock,
  faHouse,
  faListCheck,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { hrefFor } from '../routes.js'

const links = [
  { key: 'dashboard', label: 'Dashboard', icon: faHouse },
  { key: 'tasks', label: 'Workspace', icon: faListCheck },
  // { key: 'plan', label: 'Plan My Day', icon: faCalendarCheck },
  // { key: 'deadlines', label: 'Deadline Detective', icon: faClock },
]

function Navbar({ activeKey }) {
  const [open, setOpen] = useState(false)

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <a className="brand" href={hrefFor('dashboard')} onClick={() => setOpen(false)}>
          <FontAwesomeIcon icon={faBrain} className="brand-icon" />
          <span>BrainDump</span>
        </a>

        <button
          type="button"
          className="btn-icon nav-toggle"
          aria-expanded={open}
          aria-controls="main-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          <FontAwesomeIcon icon={open ? faXmark : faBars} fixedWidth />
        </button>

        <nav id="main-nav" className={`nav-menu${open ? ' is-open' : ''}`} aria-label="Main">
          <ul className="nav-list">
            {links.map((link) => (
              <li key={link.key}>
                <a
                  className="nav-link"
                  href={hrefFor(link.key)}
                  aria-current={activeKey === link.key ? 'page' : undefined}
                  data-tip={link.label}
                  onClick={() => setOpen(false)}
                >
                  <FontAwesomeIcon icon={link.icon} fixedWidth />
                  <span className="nav-label">{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}

export default Navbar
