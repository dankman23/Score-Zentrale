'use client'

import { useState } from 'react'

export default function ProdukteDropdown() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <li 
      className="nav-item dropdown"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <a className="nav-link dropdown-toggle" href="/#produkte" role="button">
        <i className="bi bi-box-seam mr-1"/>Produkte
      </a>
      <div className={`dropdown-menu ${isOpen ? 'show' : ''}`}>
        <h6 className="dropdown-header">Produkte-Module</h6>
        <a className="dropdown-item" href="/#produkte"><i className="bi bi-database mr-2"/>Artikel</a>
        <a className="dropdown-item" href="/#produktberater"><i className="bi bi-lightbulb mr-2"/>Berater</a>
      </div>
    </li>
  )
}
