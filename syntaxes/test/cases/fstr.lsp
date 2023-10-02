(defun print-xapping (xapping stream depth) 
  (declare (ignore depth)) 
  (format stream 
          ;; Are you ready for this one? 
          "~:[{~;[~]~:{~S~:[->~S~;~*~]~:^ ~}~:[~; ~]~ 
           ~{~S->~^ ~}~:[~; ~]~[~*~;->~S~;->~*~]~:[}~;]~]" 
          ;; Is that clear? 
          (xectorp xapping) 
          (do ((vp (xectorp xapping)) 
               (sp (finite-part-is-xetp xapping)) 
               (d (xapping-domain xapping) (cdr d)) 
               (r (xapping-range xapping) (cdr r)) 
               (z '() (cons (list (if vp (car r) (car d)) 
                                  (or vp sp) 
                                  (car r)) 
                            z))) 
              ((null d) (reverse z))) 
          (and (xapping-domain xapping) 
               (or (xapping-exceptions xapping) 
                   (xapping-infinite xapping))) 
          (xapping-exceptions xapping) 
          (and (xapping-exceptions xapping) 
               (xapping-infinite xapping)) 
          (ecase (xapping-infinite xapping) 
            ((nil) 0) 
            (:constant 1) 
            (:universal 2)) 
          (xapping-default xapping) 
          (xectorp xapping)))

(defun f (n) (format nil "~@(~R~) error~:P detected." n)) 