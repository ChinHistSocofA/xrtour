import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';

import './ImageSphere.scss';

function ImageSphere({ onClose, resource, variant }) {
  const [ReactPhotoSphereViewer, setReactPhotoSphereViewer] = useState();

  useEffect(() => {
    import('react-photo-sphere-viewer').then((pkg) => setReactPhotoSphereViewer(pkg.ReactPhotoSphereViewer));
  }, []);

  const imageURL = resource.Files.find((f) => f.variant === variant.code)?.URL;

  async function onReady(instance) {
    const gyroPlugin = instance.getPlugin(GyroscopePlugin);
    const isSupported = await gyroPlugin.isSupported();
    if (isSupported) {
      instance.setOption('navbar', ['gyroscope']);
      gyroPlugin.start();
    }
  }

  return (
    <div className="image-sphere">
      <div className="image-sphere__container">
        {ReactPhotoSphereViewer && (
          <ReactPhotoSphereViewer src={imageURL} height={'100%'} width={'100%'} plugins={[GyroscopePlugin]} onReady={onReady} />
        )}
      </div>
      <div className="image-sphere__close">
        <button onClick={() => onClose()} className="btn btn-lg btn-primary btn-round">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
    </div>
  );
}
export default ImageSphere;
