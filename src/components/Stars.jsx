import styles from './Stars.module.css';

export default function Stars() {
  return (
    <>
      <div className={styles.nebula}    aria-hidden="true" />
      <div className={styles.base}      aria-hidden="true" />
      <div className={styles.twinkleA}  aria-hidden="true" />
      <div className={styles.twinkleB}  aria-hidden="true" />
      <div className={styles.twinkleC}  aria-hidden="true" />
    </>
  );
}
