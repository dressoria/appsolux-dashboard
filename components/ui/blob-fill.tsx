import styles from "./animated-controls.module.css";

/** The same four staggered circles used by BlobButton, sized by the host. */
export function BlobFill() {
  return (
    <span aria-hidden="true" className={styles.blobs}>
      <span className={styles.blob} /><span className={styles.blob} />
      <span className={styles.blob} /><span className={styles.blob} />
    </span>
  );
}
