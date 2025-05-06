import { useEffect, useRef } from 'react'
import { memo } from 'react-util'
import { useContinuousRef } from 'react-util/hooks'
import { useMap } from '../MapContext'
import { useTileLayer } from './TileLayerContext'

export type TileLayerFeatureStateProps = TileLayerFeatureStateToggleProps | TileLayerFeatureStateSingleProps

interface TileLayerFeatureStateCommonProps {
  source?:      string
  sourceLayer?: string

  stateEnter: Record<string, any>
  stateExit:  Record<string, any>
}

interface TileLayerFeatureStateToggleProps extends TileLayerFeatureStateCommonProps {
  featureID: string | number
  toggle:    boolean
}

interface TileLayerFeatureStateSingleProps extends TileLayerFeatureStateCommonProps {
  featureID: string | number | null
}

export const TileLayerFeatureState = memo('TileLayerFeatureState', (props: TileLayerFeatureStateProps) => {

  const layer = useTileLayer()

  const {
    source = layer.name,
    sourceLayer,
    stateEnter,
    stateExit,
  } = props

  const stateEnterRef = useContinuousRef(stateEnter)
  const stateExitRef = useContinuousRef(stateExit)

  const toggleProps = props as TileLayerFeatureStateToggleProps
  const singleProps = props as TileLayerFeatureStateSingleProps
  const isToggle = 'toggle' in props
  
  const map = useMap()
  const prevIDRef = useRef<string | number | null>()
  const prefixedSource = source == null ? null : map.tileLayerSourceID(source)

  useEffect(() => {
    if (prefixedSource == null) { return }

    if (!isToggle && prevIDRef.current != null && prevIDRef.current !== singleProps.featureID) {
      map.setFeatureState({
        source:      prefixedSource,
        sourceLayer: sourceLayer,
        id:          prevIDRef.current,
      }, stateExitRef.current)
    }

    const toggle = isToggle ? toggleProps.toggle : true
    if (singleProps.featureID != null) {
      map.setFeatureState({
        source:      prefixedSource,
        sourceLayer: sourceLayer,
        id:          singleProps.featureID,
      }, toggle ? stateEnterRef.current : stateExitRef.current)
    }

    prevIDRef.current = singleProps.featureID
  }, [isToggle, map, prefixedSource, singleProps.featureID, source, sourceLayer, stateEnterRef, stateExitRef, toggleProps.toggle])

  useEffect(() => {
    if (prefixedSource == null) { return }

    return () => {
      if (prevIDRef.current != null) {
        map.setFeatureState({
          source:      prefixedSource,
          sourceLayer: sourceLayer,
          id:          prevIDRef.current,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, stateExitRef.current)
      }
    }
  }, [isToggle, map, prefixedSource, singleProps.featureID, source, sourceLayer, stateEnterRef, stateExitRef, toggleProps.toggle])

  return null

})