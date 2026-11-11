import { IconClose } from '../components/icons'
import { useGoBack } from '../lib/useGoBack'
import { useOnline } from '../lib/useOnline'

export const STARFRONT_STATUS_URL = 'https://status.starfront.space/'

// Starfront Observatories' live status page, shown full screen inside the app.
// It's their site in a frame, so it needs a connection and we can't restyle it.
export function StarfrontStatus() {
  const online = useOnline()
  const close = useGoBack('/')

  return (
    <div className="starfront-view">
      {online ? (
        <iframe
          className="starfront-frame"
          src={STARFRONT_STATUS_URL}
          title="Starfront Status"
          // Their page runs normally but can't navigate or take over this app.
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
        />
      ) : (
        <p className="starfront-offline">Starfront status needs an internet connection.</p>
      )}
      <button type="button" className="starfront-close" onClick={close} aria-label="Close Starfront Status">
        <IconClose size={22} />
      </button>
    </div>
  )
}
