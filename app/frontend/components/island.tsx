import * as React from 'react';

export const Island = (props: { height?: number; width?: number }) => (
  <svg
    height={props.height}
    width={props.width}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    xmlSpace="preserve"
  >
    <circle style={{ fill: '#ffec97' }} cx="255.996" cy="255.997" r="255.996" />
    <path
      style={{ fill: '#ffdb2d' }}
      d="M512 256c0-29.175-4.892-57.205-13.881-83.328L380.044 54.597s-87.681 5.797-124.305 45.366l-14.735-14.598c-29.782-34.816-89.133-25.32-89.133-25.32l34.383 34.342c10.634 12.039 20.81 24.684 29.829 36.478-48.954-20.572-120.933 54.342-120.933 54.342l87.322 90.172c-7.971 22.681-14.653 48.926-18.379 78.7-35.551 6.957-62.382 38.267-62.382 75.855 0 0 37.229 36.446 68.185 67.207 26.91 9.61 55.891 14.858 86.103 14.858C397.385 512 512 397.385 512 256z"
    />
    <path
      style={{ fill: '#c06100' }}
      d="M244.408 168.949s-83.514 80.825-83.514 237.076h83.514s-22.046-146.89 24.245-219.115l-24.245-17.961z"
    />
    <path
      style={{ fill: '#008c49' }}
      d="M251.685 180.906s-96.064-8.505-156.534 4.301c0 0 122.41-127.407 156.534-4.301z"
    />
    <path
      style={{ fill: '#00a652' }}
      d="M251.597 180.776s-52.418-80.951-99.726-120.732c.001.001 135.621-21.728 99.726 120.732z"
    />
    <path
      style={{ fill: '#00a652' }}
      d="M252.198 180.776s70.443-85.177 127.846-126.179c0 .001-189.199 12.499-127.846 126.179z"
    />
    <path
      style={{ fill: '#008c49' }}
      d="M251.685 180.745s94.287-20.263 155.874-14.997c0-.001-137.161-111.373-155.874 14.997z"
    />
    <path
      style={{ fill: '#00a652' }}
      d="M251.685 180.888s79.753 54.223 118.462 102.413c0 0-14.12-176.117-118.462-102.413z"
    />
    <path
      style={{ fill: '#ffa91f' }}
      d="M309.766 322.852c-35.459 0-66.887 17.24-86.375 43.79-12.561-8.822-27.853-14.016-44.368-14.016-42.697 0-77.31 34.613-77.31 77.31H416.85c-.001-59.142-47.944-107.084-107.084-107.084z"
    />
    <path
      style={{ fill: '#f80' }}
      d="M416.849 429.934c0-59.14-47.942-107.083-107.083-107.083-18.26 0-35.446 4.582-50.489 12.642v94.441h157.572z"
    />
  </svg>
);
