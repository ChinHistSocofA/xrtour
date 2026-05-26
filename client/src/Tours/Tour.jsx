import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { pluralize } from 'inflection';

import Api from '../Api';
import { useAuthContext } from '../AuthContext';
import { useStaticContext } from '../StaticContext';
import ConfirmModal from '../Components/ConfirmModal';
import FormGroup from '../Components/FormGroup';
import PreviewButton from '../Components/PreviewButton';
import VariantTabs from '../Components/VariantTabs';
import ResourcesModal from '../Resources/ResourcesModal';
import StopsModal from '../Stops/StopsModal';
import StopsTable from '../Stops/StopsTable';
import SharePreview from '../Components/SharePreview';

function getVariantFile(files, variant, fallbackVariant, variantSuffix = '') {
  let file = files.find((f) => f.variant === `${variant?.code}${variantSuffix}`);
  if (!file?.key) {
    file = files.find((f) => f.variant === `${fallbackVariant?.code}${variantSuffix}`);
  }
  return file;
}

function Tour() {
  const { membership } = useAuthContext();
  const staticContext = useStaticContext();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { TourId } = useParams();
  const [tour, setTour] = useState();
  const [variant, setVariant] = useState();
  const [stops, setStops] = useState();

  useEffect(() => {
    let isCancelled = false;
    Api.tours
      .get(TourId)
      .then((response) => {
        if (isCancelled) return;
        setTour(response.data);
        setVariant(response.data.variants[0]);
        return Api.tours.stops(TourId).index();
      })
      .then((response) => {
        if (isCancelled) return;
        setStops(response.data);
      });
    return () => (isCancelled = true);
  }, [TourId]);

  const [isConfirmArchiveShowing, setConfirmArchiveShowing] = useState(false);

  async function archiveTour() {
    await Api.tours.archive(tour.id);
    setConfirmArchiveShowing(false);
    navigate('/');
  }

  const [isConfirmRestoreShowing, setConfirmRestoreShowing] = useState(false);

  async function restoreTour() {
    await Api.tours.restore(tour.id);
    let response = await Api.tours.get(TourId);
    setTour(response.data);
    setVariant(response.data.variants[0]);
    response = await Api.tours.stops(TourId).index();
    setStops(response.data);
    setConfirmRestoreShowing(false);
  }

  const [isConfirmDeleteShowing, setConfirmDeleteShowing] = useState(false);

  async function deleteTour() {
    await Api.tours.delete(tour.id);
    setConfirmDeleteShowing(false);
    navigate('/');
  }

  const [isShowingResourcesModal, setShowingResourcesModal] = useState(false);

  function onHideResourcesModal() {
    setShowingResourcesModal(false);
    setSearchParams();
  }

  async function onSelectResource(resource) {
    await Api.tours.update(tour.id, { CoverResourceId: resource.id });
    const newTour = { ...tour };
    newTour.CoverResource = resource;
    setTour(newTour);
    onHideResourcesModal();
  }

  const [stopType, setStopType] = useState('STOP');
  const [isShowingStopsModal, setShowingStopsModal] = useState(false);

  function onHideStopsModal() {
    setShowingStopsModal(false);
    setSearchParams();
  }

  async function onSelectStop(stop) {
    onHideStopsModal();
    if (stop.type === 'INTRO') {
      await Api.tours.update(tour.id, { IntroStopId: stop.id });
      const newTour = { ...tour };
      newTour.IntroStop = stop;
      newTour.IntroStopId = stop.id;
      setTour(newTour);
      onClickStop('INTRO', stop);
    } else if (stop.type === 'STOP') {
      const response = await Api.tours.stops(TourId).create({
        StopId: stop.id,
        position: stops.reduce((max, current) => Math.max(max, current), 0) + 1,
      });
      const newStops = [...stops, response.data];
      setStops(newStops);
      onClickStop('STOP', response.data);
    }
  }

  function onClickStop(type, stop) {
    navigate(`${pluralize(type).toLocaleLowerCase()}/${stop.id}`);
  }

  async function onRemoveIntro() {
    await Api.tours.update(tour.id, { IntroStopId: null });
    const newTour = { ...tour };
    newTour.IntroStop = null;
    setTour(newTour);
  }

  async function onRemoveStop(stop) {
    await Api.tours.stops(tour.id).remove(stop.id);
    const newStops = [...stops];
    const index = newStops.indexOf(stop);
    newStops.splice(index, 1);
    setStops(newStops);
  }

  async function onReorderStops(newStops) {
    if (JSON.stringify(stops) !== JSON.stringify(newStops)) {
      setStops(newStops);
      await Api.tours.stops(tour.id).reorder({ TourStops: newStops.map((ts, i) => ({ id: ts.id, position: i + 1 })) });
    }
  }

  const isEditor = membership?.role !== 'VIEWER';
  const isArchived = !!tour?.archivedAt;
  const isEditable = isEditor && !isArchived;
  const fallbackVariant = tour?.variants[0];

  return (
    <>
      <Helmet>
        <title>
          {tour?.name ?? ''} - {staticContext?.env?.SITE_TITLE}
        </title>
      </Helmet>
      <main className="container">
        {!tour && <div className="spinner-border"></div>}
        {tour && (
          <>
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb">
                <li className="breadcrumb-item">
                  <Link to="/">Home</Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  {tour.name}
                </li>
              </ol>
            </nav>
            <h1 className="mb-3">{tour.name}</h1>
            <div className="row">
              <div className="col-md-6">
                <form className="mb-5">
                  <FormGroup plaintext name="name" label="Name" value={tour.name} />
                  <FormGroup
                    plaintext
                    name="link"
                    label="Published Link"
                    value={`https://${membership?.Team?.link}.xrtour.org/${tour.link}`}
                  />
                  <VariantTabs variants={tour.variants} current={variant} setVariant={setVariant} />
                  <FormGroup plaintext name="variant.displayName" label="Language Name" value={variant.displayName} />
                  <FormGroup plaintext name="names" label="Display Name" value={tour.names[variant.code]} />
                  <FormGroup type="textarea" plaintext name="descriptions" label="Description" value={tour.descriptions[variant.code]} />
                  <div className="mb-3 d-flex justify-content-between">
                    <div>
                      {isEditable && (
                        <Link className="btn btn-primary me-2" to="edit">
                          Edit
                        </Link>
                      )}
                      <PreviewButton href={`/teams/${membership?.TeamId}/tours/${TourId}/preview`} variant={variant} />
                      {isEditor && (
                        <Link className="btn btn-outline-primary" to="publish">
                          Publish
                        </Link>
                      )}
                    </div>
                    {isEditable && (
                      <div>
                        <button onClick={() => setConfirmArchiveShowing(true)} type="button" className="btn btn-outline-primary">
                          Archive
                        </button>
                      </div>
                    )}
                    {isArchived && isEditor && (
                      <div>
                        <button onClick={() => setConfirmRestoreShowing(true)} type="button" className="btn btn-outline-primary me-2">
                          Restore
                        </button>
                        <button onClick={() => setConfirmDeleteShowing(true)} type="button" className="btn btn-primary">
                          Delete Permanently
                        </button>
                      </div>
                    )}
                  </div>
                </form>
                <div className="mb-5">
                  <h2>Social Media Share Image</h2>
                  {tour.CoverResource && (
                    <div className="row">
                      <div className="col-6">
                        <img
                          className="img-thumbnail mb-3"
                          src={getVariantFile(tour.CoverResource.Files, variant, fallbackVariant).URL}
                          alt="Cover"
                        />
                      </div>
                    </div>
                  )}
                  {isEditable && (
                    <button onClick={() => setShowingResourcesModal(true)} type="button" className="btn btn-primary">
                      Select Image
                    </button>
                  )}
                </div>
                <h2>Intro</h2>
                <StopsTable
                  type="INTRO"
                  stops={tour.IntroStop ? [{ id: tour.IntroStopId, Stop: tour.IntroStop }] : []}
                  onClick={onClickStop}
                  onRemove={onRemoveIntro}
                  isEditable={isEditable}
                />
                <div className="mb-5">
                  {isEditable && (
                    <button
                      onClick={() => {
                        setStopType('INTRO');
                        setShowingStopsModal(true);
                      }}
                      type="button"
                      className="btn btn-primary">
                      Set Intro
                    </button>
                  )}
                </div>
                <h2>Stops</h2>
                <StopsTable
                  stops={stops}
                  onClick={onClickStop}
                  onRemove={onRemoveStop}
                  onReorderStops={onReorderStops}
                  isEditable={isEditable}
                />
                <div className="mb-5">
                  {isEditable && (
                    <button
                      onClick={() => {
                        setStopType('STOP');
                        setShowingStopsModal(true);
                      }}
                      type="button"
                      className="btn btn-primary">
                      Add Stop
                    </button>
                  )}
                </div>
              </div>
              <div className="col-md-4 offset-md-1">
                <SharePreview tour={tour} />
              </div>
            </div>
          </>
        )}
        {isShowingResourcesModal && (
          <ResourcesModal
            isShowing={true}
            onHide={onHideResourcesModal}
            onSelect={onSelectResource}
            types={['IMAGE']}
            variants={tour?.variants}
          />
        )}
        {isShowingStopsModal && (
          <StopsModal
            type={stopType}
            types={[stopType]}
            variants={tour?.variants}
            isShowing={true}
            onHide={onHideStopsModal}
            onSelect={onSelectStop}
          />
        )}
        {isConfirmArchiveShowing && (
          <ConfirmModal isShowing={true} title="Archive Tour" onCancel={() => setConfirmArchiveShowing(false)} onOK={() => archiveTour()}>
            Are you sure you wish to archive this tour <b>{tour?.name}</b>?
          </ConfirmModal>
        )}
        {isConfirmRestoreShowing && (
          <ConfirmModal isShowing={true} title="Restore Tour" onCancel={() => setConfirmRestoreShowing(false)} onOK={() => restoreTour()}>
            Are you sure you wish to restore this tour <b>{tour?.name}</b>?
          </ConfirmModal>
        )}
        {isConfirmDeleteShowing && (
          <ConfirmModal
            isShowing={true}
            title="Delete Tour Permanently"
            onCancel={() => setConfirmDeleteShowing(false)}
            onOK={() => deleteTour()}>
            <p>
              Are you sure you wish to delete this tour <b>{tour?.name}</b> permanently?
            </p>
            <p>This cannot be undone!</p>
          </ConfirmModal>
        )}
      </main>
    </>
  );
}
export default Tour;
