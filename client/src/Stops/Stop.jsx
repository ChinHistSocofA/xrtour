import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import PropTypes from 'prop-types';
import { capitalize } from 'inflection';
import { StatusCodes } from 'http-status-codes';

import PhoneScreen from 'shared/Components/Viewer/PhoneScreen';
import StopViewer from 'shared/Components/Viewer/StopViewer';

import Api from '../Api';
import ConfirmModal from '../Components/ConfirmModal';
import FormGroup from '../Components/FormGroup';
import PreviewButton from '../Components/PreviewButton';
import VariantTabs from '../Components/VariantTabs';
import Recorder from '../Resources/Recorder';
import ResourcesModal from '../Resources/ResourcesModal';
import ResourcesTable from '../Resources/ResourcesTable';
import { useStaticContext } from '../StaticContext';
import { useAuthContext } from '../AuthContext';

function resourceSortComparator(r1, r2) {
  let result = r1.Resource.type.localeCompare(r2.Resource.type);
  if (result === 0) {
    result = Math.sign(r1.start - r2.start);
    if (result === 0) {
      result = r1.Resource.name.localeCompare(r2.Resource.name);
    }
  }
  return result;
}

function Stop({ StopId, transition, children }) {
  const { membership } = useAuthContext();
  const staticContext = useStaticContext();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { StopId: StopIdParam, TourId, TourStopId } = useParams();
  const [tour, setTour] = useState();
  const [stop, setStop] = useState();
  const [variant, setVariant] = useState();
  const [resources, setResources] = useState();

  useEffect(() => {
    let isCancelled = false;
    if (TourId) {
      Api.tours.get(TourId).then((response) => {
        if (isCancelled) return;
        setTour(response.data);
      });
    }
    return () => (isCancelled = true);
  }, [TourId]);

  useEffect(() => {
    let isCancelled = false;
    if (StopId || StopIdParam) {
      let newStop;
      Api.stops
        .get(StopId ?? StopIdParam)
        .then((response) => {
          if (isCancelled) return;
          newStop = response.data;
          setStop(newStop);
          setVariant(response.data.variants[0]);
          return Api.stops.resources(StopId ?? StopIdParam).index();
        })
        .then((response) => {
          if (isCancelled) return;
          newStop.Resources = response.data;
          setStop({ ...newStop });
          setResources(response.data);
        });
    }
    return () => (isCancelled = true);
  }, [StopId, StopIdParam]);

  const [isConfirmArchiveShowing, setConfirmArchiveShowing] = useState(false);
  const [error, setError] = useState();

  async function archiveStop() {
    try {
      await Api.stops.archive(stop.id);
      navigate(`/teams/${membership.TeamId}/stops?type=${stop.type}`);
    } catch (error) {
      setConfirmArchiveShowing(false);
      if (error.response?.status === StatusCodes.CONFLICT) {
        setError(error);
      }
    }
  }

  const [isConfirmRestoreShowing, setConfirmRestoreShowing] = useState(false);

  async function restoreStop() {
    await Api.stops.restore(stop.id);
    let response = await Api.stops.get(stop.id);
    const { data: newStop } = response;
    response = await Api.stops.resources(stop.id).index();
    newStop.Resources = response.data;
    setStop(newStop);
    setVariant(newStop.variants[0]);
    setResources(response.data);
    setConfirmRestoreShowing(false);
  }

  const [isConfirmDeleteShowing, setConfirmDeleteShowing] = useState(false);

  async function deleteStop() {
    try {
      await Api.stops.delete(stop.id);
      navigate(`/teams/${membership.TeamId}/stops?type=${stop.type}`);
    } catch (error) {
      setConfirmDeleteShowing(false);
      if (error.response?.status === StatusCodes.CONFLICT) {
        setError(error);
      }
    }
  }

  const [isRecording, setRecording] = useState(false);
  const [position, setPosition] = useState(0);
  const [isShowingResourcesModal, setShowingResourcesModal] = useState(false);

  function onHideResourcesModal() {
    setShowingResourcesModal(false);
    setSearchParams();
  }

  async function onSelectResource(resource) {
    const response = await Api.stops.resources(stop.id).create({
      ResourceId: resource.id,
    });
    const newResources = [...resources, response.data];
    newResources.sort(resourceSortComparator);
    setResources(newResources);
    setStop({ ...stop, Resources: newResources });
    onHideResourcesModal();
  }

  function onClickResource(resource) {
    setPosition(resource.start);
  }

  async function onChangeResource(resource) {
    await Api.stops.resources(stop.id).update(resource.id, resource);
    const newResources = [...resources];
    newResources.sort(resourceSortComparator);
    setResources(newResources);
    setStop({ ...stop, Resources: newResources });
  }

  async function onRemoveResource(resource) {
    await Api.stops.resources(stop.id).remove(resource.id);
    const newResources = [...resources];
    const index = newResources.indexOf(resource);
    newResources.splice(index, 1);
    setResources(newResources);
    setStop({ ...stop, Resources: newResources });
  }

  async function onSaveRecording(blob) {
    const resource = {
      TeamId: stop.TeamId,
      name: stop.name,
      type: 'AUDIO',
      variants: stop.variants,
      Files: [
        {
          variant: variant.code,
          key: blob.signed_id,
          originalName: `${stop.name}.${variant.code}.mp3`,
          duration: blob.duration,
        },
      ],
    };
    const response = await Api.resources.create(resource);
    setRecording(false);
    return onSelectResource(response.data);
  }

  const isEditor = membership?.role !== 'VIEWER';
  const isArchived = !!stop?.archivedAt;
  const isEditable = isEditor && !isArchived;

  const title = stop?.name ?? '';
  const primaryVariant = stop?.variants[0];

  return (
    <>
      <Helmet>
        <title>
          {title} - {staticContext?.env?.SITE_TITLE}
        </title>
      </Helmet>
      <main className="container">
        {!stop && <div className="spinner-border"></div>}
        {!!stop && (
          <>
            <div className="row">
              <div className="col-md-7">
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                      <Link to="/">Home</Link>
                    </li>
                    {tour && (
                      <li className="breadcrumb-item">
                        <Link to={`/teams/${tour?.TeamId}/tours/${tour?.id}`}>{tour?.name}</Link>
                      </li>
                    )}
                    {!tour && (
                      <li className="breadcrumb-item">
                        <Link to={`/teams/${membership?.TeamId}/stops`}>Stops</Link>
                      </li>
                    )}
                    <li className="breadcrumb-item active" aria-current="page">
                      {title}
                    </li>
                  </ol>
                </nav>
                <h1 className="mb-3">{title}</h1>
                <form className="mb-5">
                  <FormGroup plaintext name="name" label="Name" record={stop} />
                  {stop.type === 'STOP' && (
                    <>
                      <FormGroup plaintext name="link" label="Link" record={stop} />
                      <FormGroup plaintext name="address" label="Address" record={stop} />
                    </>
                  )}
                  {stop.type === 'TRANSITION' && (
                    <>
                      <FormGroup plaintext name="address" label="Starting Address" record={stop} />
                      <FormGroup plaintext name="destAddress" label="Destination Address" record={stop} />
                    </>
                  )}
                  <VariantTabs variants={stop?.variants} current={variant} setVariant={setVariant} />
                  <FormGroup plaintext name="name" label="Display Name" value={stop.names[variant.code]} />
                  <FormGroup plaintext type="textarea" name="description" label="Description" value={stop.descriptions[variant.code]} />
                  <div className="d-flex justify-content-between mb-3">
                    {isEditable && (
                      <>
                        <div>
                          {!isRecording && (
                            <>
                              <Link className="btn btn-primary" to="edit">
                                Edit
                              </Link>
                              &nbsp;
                              <button onClick={() => setRecording(true)} className="btn btn-outline-danger" type="button">
                                Record
                              </button>
                              {tour && (
                                <>
                                  &nbsp;
                                  <PreviewButton
                                    href={`/teams/${tour.TeamId}/tours/${tour.id}/preview${TourStopId ? `/stops/${TourStopId}` : ''}`}
                                    variant={variant}
                                  />
                                </>
                              )}
                            </>
                          )}
                          {isRecording && <Recorder onSave={onSaveRecording} onCancel={() => setRecording(false)} />}
                        </div>
                        <div>
                          <button onClick={() => setConfirmArchiveShowing(true)} type="button" className="btn btn-outline-primary">
                            Archive
                          </button>
                        </div>
                      </>
                    )}
                    {isArchived && (
                      <>
                        <div></div>
                        <div>
                          <button onClick={() => setConfirmRestoreShowing(true)} type="button" className="btn btn-outline-primary me-2">
                            Restore
                          </button>
                          <button onClick={() => setConfirmDeleteShowing(true)} type="button" className="btn btn-primary">
                            Delete Permanently
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </form>
                <h2>Assets</h2>
                <ResourcesTable
                  variant={variant}
                  fallbackVariant={primaryVariant}
                  variants={stop?.variants}
                  resources={resources}
                  onClick={onClickResource}
                  onChange={onChangeResource}
                  onRemove={onRemoveResource}
                  isEditable={isEditable}
                />
                <div className="mb-5">
                  {isEditable && (
                    <button onClick={() => setShowingResourcesModal(true)} type="button" className="btn btn-primary">
                      Add Asset
                    </button>
                  )}
                </div>
                {children}
              </div>
              <div className="col-md-5">
                <PhoneScreen className="mx-auto">
                  <PhoneScreen className="position-fixed">
                    <StopViewer
                      position={position}
                      team={membership?.Team}
                      stop={stop}
                      transition={transition}
                      variant={variant}
                      fallbackVariant={primaryVariant}
                      onTimeUpdate={(newPosition) => setPosition(newPosition)}
                    />
                  </PhoneScreen>
                </PhoneScreen>
              </div>
            </div>
          </>
        )}
        {isShowingResourcesModal && (
          <ResourcesModal isShowing={true} onHide={onHideResourcesModal} onSelect={onSelectResource} variants={stop?.variants} />
        )}
        {isConfirmArchiveShowing && (
          <ConfirmModal
            isShowing={true}
            title={`Archive ${capitalize(stop?.type)}`}
            onCancel={() => setConfirmArchiveShowing(false)}
            onOK={() => archiveStop()}>
            Are you sure you wish to archive <b>{stop?.name}</b>?
          </ConfirmModal>
        )}
        {isConfirmRestoreShowing && (
          <ConfirmModal
            isShowing={true}
            title={`Restore ${capitalize(stop?.type)}`}
            onCancel={() => setConfirmRestoreShowing(false)}
            onOK={() => restoreStop()}>
            Are you sure you wish to restore <b>{stop?.name}</b>?
          </ConfirmModal>
        )}
        {isConfirmDeleteShowing && (
          <ConfirmModal
            isShowing={true}
            title={`Delete ${capitalize(stop?.type)} Permanently`}
            onCancel={() => setConfirmDeleteShowing(false)}
            onOK={() => deleteStop()}>
            <p>
              Are you sure you wish to delete <b>{stop?.name}</b> permanently?
            </p>
            <p>This cannot be undone!</p>
          </ConfirmModal>
        )}
        {!!error && (
          <ConfirmModal isShowing={true} title={`An error has occurred`} onOK={() => setError()}>
            <p>This {capitalize(stop?.type)} is still in use by the following tours:</p>
            <div>
              {error.response?.data?.map((t) => (
                <div key={t.id}>
                  <Link to={`/teams/${t.TeamId}/tours/${t.id}`}>{t.names[t.variants[0].code]}</Link>
                </div>
              ))}
            </div>
          </ConfirmModal>
        )}
      </main>
    </>
  );
}

Stop.propTypes = {
  StopId: PropTypes.string,
  transition: PropTypes.object,
  children: PropTypes.node,
};

export default Stop;
