import { back } from '../lib/router'
import { IconBack } from '../components/icons'

/** The bar's back control. The same gesture works from the left edge. */
export const BackButton = ({ label }: { label?: string }) => (
  <button className="btn-plain back" aria-label="Back" onClick={back}>
    <IconBack />
    {label ? <span>{label}</span> : null}
  </button>
)
