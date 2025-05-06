import { createContext, useEffect, useMemo } from 'react'
import { memo } from 'react-util'
import { LayerCategory as LayerCategoryModel } from '~/stores/map'
import { IconProp } from '~/ui/components'
import { useMap } from '~/ui/hooks'

export interface LayerCategoryProps {
  name:       string
  label:      string
  icon?:      IconProp
  exclusive?: boolean
  children?:  React.ReactNode
}

export const LayerCategory = memo('LayerCategory', (props: LayerCategoryProps) => {

  const {name, label, icon, exclusive = false, children} = props
  const map = useMap()

  const category = useMemo((): LayerCategoryModel => ({
    name,
    label,
    icon,
    exclusive,
  }), [exclusive, icon, label, name])

  useEffect(() => {
    return map.registerLayerCategory(category)
  }, [category, map])

  return (
    <LayerCategoryContext.Provider value={category}>
      {children}
    </LayerCategoryContext.Provider>
  )


})

export const LayerCategoryContext = createContext<LayerCategoryModel | null>(null)