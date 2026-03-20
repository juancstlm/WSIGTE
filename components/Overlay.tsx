import React from 'react';
import { STATUS } from '../types';

interface OverlayProps {
  visible: boolean
  status: string
  title: string
  children?: React.ReactElement
}
export const Overlay: React.FC<OverlayProps> = ({visible, status, title, children }) => {
  return visible ?
      <div className='loadingScreenContainer'>
        <h1 className='loadingScreenTitle'>{title}</h1>
        {status === STATUS.INIT ? <p className='loadingScreenSubtitle'>Loading</p> : null}
        <p className='loadingScreenStatus'>{status}</p>
        {children ? children : null}
      </div>: null;
}
