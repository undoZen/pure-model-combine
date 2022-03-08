import React from 'react'

const CaretDownSelectedIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-full stroke-[#737373]"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export default React.memo(CaretDownSelectedIcon)
