FROM centos

# Update to latest CentOS mirror, Install required tools (git, easy-rsa, and AWS CLI)
RUN cd /etc/yum.repos.d/ && \
    sed -i 's/mirrorlist/#mirrorlist/g' /etc/yum.repos.d/CentOS-* && \
    sed -i 's|#baseurl=http://mirror.centos.org|baseurl=http://vault.centos.org|g' /etc/yum.repos.d/CentOS-* && \
    yum -y update && \
    yum -y install git unzip openssl && \
    yum -y install openssl-devel && \
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install

# Create a directory for the Easy-RSA setup
WORKDIR /cloned

# Clone Easy-RSA repository
RUN git clone https://github.com/OpenVPN/easy-rsa.git

# Create the necessary certifiactes
RUN /cloned/easy-rsa/easyrsa3/easyrsa init-pki && \
    echo "fb-vpn-server" | /cloned/easy-rsa/easyrsa3/easyrsa build-ca nopass && \
    echo "yes" | /cloned/easy-rsa/easyrsa3/easyrsa build-server-full fb-vpn-server nopass && \
    echo "yes" | /cloned/easy-rsa/easyrsa3/easyrsa build-client-full fb-vpn-client nopass

# Create the /certs directory
RUN mkdir /certs

# Create a script to copy the certificates to the mounted /certs directory and upload the certs to aws acm at runtime.
# Save the arn of the uploaded server and root certificates into a file in the mounted directory for certificates so it can be referenced later.
RUN echo '#!/bin/bash' > /usr/local/bin/export-certificates-to-host-and-acm.sh && \
    echo 'cp /cloned/pki/ca.crt /certs/' >> /usr/local/bin/export-certificates-to-host-and-acm.sh && \
    echo 'cp /cloned/pki/private/ca.key /certs/' >> /usr/local/bin/export-certificates-to-host-and-acm.sh && \
    echo 'cp /cloned/pki/issued/fb-vpn-server.crt /certs/' >> /usr/local/bin/export-certificates-to-host-and-acm.sh && \
    echo 'cp /cloned/pki/private/fb-vpn-server.key /certs/' >> /usr/local/bin/export-certificates-to-host-and-acm.sh && \
    echo 'cp /cloned/pki/issued/fb-vpn-client.crt /certs/' >> /usr/local/bin/export-certificates-to-host-and-acm.sh && \
    echo 'cp /cloned/pki/private/fb-vpn-client.key /certs/' >> /usr/local/bin/export-certificates-to-host-and-acm.sh && \
    echo 'touch /certs/ca.key' >> /usr/local/bin/export-certificates-to-host-and-acm.sh && \
    echo 'aws acm import-certificate --certificate fileb:///certs/ca.crt --private-key fileb:///certs/ca.key --tags Key=Name,Value=fb-vpn-ca --region $AWS_REGION | tee /certs/fb-vpn-ca-arn.json' >> /usr/local/bin/export-certificates-to-host-and-acm.sh && \
    echo 'aws acm import-certificate --certificate fileb:///certs/fb-vpn-server.crt --private-key fileb:///certs/fb-vpn-server.key --certificate-chain fileb:///certs/ca.crt --tags Key=Name,Value=fb-vpn-server --region $AWS_REGION | tee /certs/fb-vpn-server-arn.json' >> /usr/local/bin/export-certificates-to-host-and-acm.sh && \
    chmod +x /usr/local/bin/export-certificates-to-host-and-acm.sh

# Set the above script as the entry point
ENTRYPOINT ["/usr/local/bin/export-certificates-to-host-and-acm.sh"]
