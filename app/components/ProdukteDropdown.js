'use client'

export default function ProdukteDropdown() {
  return (
    <li className="nav-item dropdown">
      <a className="nav-link dropdown-toggle" href="/#produkte" id="produkteDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        <i className="bi bi-box-seam mr-1"/>Produkte
      </a>
      <div className="dropdown-menu" aria-labelledby="produkteDropdown">
        <h6 className="dropdown-header">Produkte-Module</h6>
        <a className="dropdown-item" href="/#produkte"><i className="bi bi-database mr-2"/>Artikel</a>
        <a className="dropdown-item" href="/#produktberater"><i className="bi bi-lightbulb mr-2"/>Berater</a>
      </div>
    </li>
  )
}
