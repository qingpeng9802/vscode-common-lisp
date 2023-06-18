(defun make-my-array (size &key (init-value nil init-value-supplied-p))
   (if init-value-supplied-p
       (make-array size :initial-element init-value)
       (make-array size)))
(let* (( #| sdsdsadsa |#
    revsym (find-symbol (string :*asdf-revision*) :asdf))
     (rev (and revsym (boundp revsym) (symbol-value revsym))))
(etypecase rev
  (string rev)
  (cons (format nil "~{~D~^.~}" rev))
  (null "1.0")))
  ;; Syntactic sugar for call-with-asdf-session
  (defmacro with-asdf-session ((&key key override override-cache override-forcing) &body body)
    `(call-with-asdf-session
      #'(lambda () ,@body)
      :override ,override :key ,key
      :override-cache ,override-cache :override-forcing ,override-forcing))

  (defun reset-system-class (system new-class &rest keys &key &allow-other-keys)
    "Erase any data from a SYSTEM except its basic identity, then reinitialize it
based on supplied KEYS."
    (change-class (change-class system 'proto-system) new-class)
    (apply 'reinitialize-instance system keys)))

 (defmacro while-visiting-action ((o c) &body body)
    `(call-while-visiting-action ,o ,c #'(lambda () ,@body))))

(defmacro define-convenience-action-methods
      (function formals &key if-no-operation if-no-component)
    (let* ((rest (gensym "REST"))
           (found (gensym "FOUND"))
           (keyp (equal (last formals) '(&key)))
           (formals-no-key (if keyp (butlast formals) formals))
           (len (length formals-no-key))
           (operation 'operation)
           (component 'component)
           (opix (position operation formals))
           (coix (position component formals))
           (prefix (subseq formals 0 opix))
           (suffix (subseq formals (1+ coix) len))
           (more-args (when keyp `(&rest ,rest &key &allow-other-keys))))
      (assert (and (integerp opix) (integerp coix) (= coix (1+ opix))))
      (flet ((next-method (o c)
               (if keyp
                   `(apply ',function ,@prefix ,o ,c ,@suffix ,rest)
                   `(,function ,@prefix ,o ,c ,@suffix))))
        `(progn
           (defmethod ,function (,@prefix (,operation string) ,component ,@suffix ,@more-args)
             (declare (notinline ,function))
             (let ((,component (find-component () ,component))) ;; do it first, for defsystem-depends-on
               ,(next-method `(safe-read-from-string ,operation :package :asdf/interface) component)))
           (defmethod ,function (,@prefix (,operation symbol) ,component ,@suffix ,@more-args)
             (declare (notinline ,function))
             (if ,operation
                 ,(next-method
                   `(make-operation ,operation)
                   `(or (find-component () ,component) ,if-no-component))
                 ,if-no-operation))
           (defmethod ,function (,@prefix (,operation operation) ,component ,@suffix ,@more-args)
             (declare (notinline ,function))
             (if (typep ,component 'component)
                 (error "No defined method for ~S on ~/asdf-action:format-action/"
                        ',function (make-action ,operation ,component))
                 (if-let (,found (find-component () ,component))
                    ,(next-method operation found)
                    ,if-no-component)))))))
        (defun resolve-dependency-name (component name &optional version)
        (loop
        (restart-case
            (return
                (let ((comp (find-component (component-parent component) name)))
                (unless comp
                    (error 'missing-dependency
                        :required-by component
                        :requires name))
                (when version
                    (unless (version-satisfies comp version)
                    (error 'missing-dependency-of-version
                            :required-by component
                            :version version
                            :requires name)))
                comp))
            (retry ()
            :report (lambda (s)
                        (format s (compatfmt "~@<Retry loading ~3i~_~A.~@:>") name))
            :test
            (lambda (c)
                (or (null c)
                    (and (typep c 'missing-dependency)
                        (eq (missing-required-by c) component)
                        (equal (missing-requires c) name))))
            (unless (component-parent component)
                (let ((name (coerce-name name)))
                (unset-asdf-cache-entry `(find-system ,name))))))))


