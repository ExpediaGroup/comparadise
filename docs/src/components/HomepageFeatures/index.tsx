import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg?: React.ComponentType<React.ComponentProps<'svg'>>;
  imageSrc?: string;
  description: React.ReactElement;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Easy to Use',
    imageSrc:
      'https://images.unsplash.com/photo-1592678043083-dd322655ad1f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=986&q=80',
    description: (
      <>
        Comparadise makes it easy to review visual changes on pull requests, and
        getting started is a breeze.
      </>
    )
  },
  {
    title: 'Lightweight',
    imageSrc:
      'https://images.unsplash.com/photo-1499346030926-9a72daac6c63?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
    description: (
      <>
        Start leveraging cloud storage for managing base images, and stop
        committing images to source control!
      </>
    )
  },
  {
    title: 'All in One Solution',
    imageSrc:
      'https://images.unsplash.com/reserve/oIpwxeeSPy1cnwYpqJ1w_Dufer%20Collateral%20test.jpg?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1915&q=80',
    description: (
      <>
        Comparadise provides all the tools necessary to get started with visual
        regression testing from scratch, with no learning curve!
      </>
    )
  }
];

function Feature({ title, imageSrc, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <img alt={title} src={imageSrc} height={200} />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): React.ReactElement {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
